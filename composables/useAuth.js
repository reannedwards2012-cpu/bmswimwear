/**
 * Customer authentication — Supabase Auth, email + password.
 *
 * The browser client is built with the PUBLISHABLE key only (from
 * runtimeConfig.public). RLS is enforced on every request it makes; it can
 * never bypass RLS. The SECRET key is never referenced here and never reaches
 * the browser — server code uses server/utils/supabaseAdmin.js instead.
 *
 * Session persistence + auto-refresh are handled by supabase-js (localStorage).
 * `plugins/auth.client.js` calls `initAuthClient()` once at startup to hydrate
 * the reactive state and subscribe to auth changes.
 *
 * We do not build or store passwords — every password operation is a call to
 * `supabase.auth.*`.
 */
import { computed } from 'vue'
import { createClient } from '@supabase/supabase-js'
import { writeLastActive } from '~/utils/idleSession'

const USER_KEY = 'bm-user'
const READY_KEY = 'bm-auth-ready'
const MFA_LEVEL_KEY = 'bm-mfa-level'

// A successful interactive authentication is the strongest possible "activity":
// it starts a clean 24h idle window and overwrites any stale/expired
// last-active timestamp left behind by an earlier failed idle sign-out. Used by
// plugins/idle-logout.client.js. No-op on the server / when storage is
// unavailable (writeLastActive is wrapped).
function markAuthenticatedNow() {
  if (import.meta.client) writeLastActive(window.localStorage, Date.now())
}

// Module-singleton browser client — created once, client-side only.
let _client = null

function getClient() {
  if (_client) return _client
  if (!import.meta.client) return null

  const { supabaseUrl, supabaseKey } = useRuntimeConfig().public
  if (!supabaseUrl || !supabaseKey) {
    console.error('[auth] Supabase public config missing (supabaseUrl / supabaseKey)')
    return null
  }

  _client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit'
    }
  })
  return _client
}

const trimEmail = (v) => String(v ?? '').trim()
const originUrl = (path) => (import.meta.client ? `${window.location.origin}${path}` : undefined)

/**
 * Called once by plugins/auth.client.js: restore the session from storage,
 * publish the current user, then keep it in sync with auth-state changes.
 */
export async function initAuthClient() {
  const user = useState(USER_KEY, () => null)
  const ready = useState(READY_KEY, () => false)
  const mfaLevel = useState(MFA_LEVEL_KEY, () => ({ current: null, next: null }))

  const client = getClient()
  if (!client) {
    ready.value = true
    return
  }

  try {
    const { data } = await client.auth.getSession()
    user.value = data.session?.user ?? null
  } catch (err) {
    console.error('[auth] session hydrate failed:', err?.message)
    user.value = null
  }

  await refreshMfaLevel(client, mfaLevel)
  ready.value = true

  client.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user ?? null
    // Fire-and-forget — this is reactive UX state (drives the admin MFA
    // enrollment/step-up redirects), not a security boundary. Every admin
    // API route re-verifies the real aal2 claim server-side regardless.
    refreshMfaLevel(client, mfaLevel)
  })
}

/**
 * Phase 3 (MFA) — refresh the reactive currentLevel/nextLevel pair from the
 * CURRENT session (no jwt arg: fast, rarely touches the network per
 * supabase-js's own docs). Never throws; degrades to {null, null} so a
 * transient failure never fakes "MFA satisfied".
 */
async function refreshMfaLevel(client, mfaLevel) {
  try {
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
    mfaLevel.value = error || !data ? { current: null, next: null } : { current: data.currentLevel, next: data.nextLevel }
  } catch {
    mfaLevel.value = { current: null, next: null }
  }
}

/** Fully-awaited refresh of BOTH `user` and `mfaLevel` — used wherever a
 * caller needs isAdmin/needsMfaStepUp to be reliably current the moment
 * this resolves (signIn, and after a successful MFA verify). */
async function syncUserAndMfaLevel(client, user, mfaLevel) {
  try {
    const { data } = await client.auth.getUser()
    user.value = data?.user ?? null
  } catch {
    user.value = null
  }
  await refreshMfaLevel(client, mfaLevel)
}

export function useAuth() {
  const user = useState(USER_KEY, () => null)
  const authReady = useState(READY_KEY, () => false)
  const mfaLevel = useState(MFA_LEVEL_KEY, () => ({ current: null, next: null }))
  const isLoggedIn = computed(() => !!user.value)
  // Display-only. Never used for authorization — every admin API route
  // independently re-verifies app_metadata.is_admin from the live Supabase
  // user record via requireAdmin(). This just drives UX (nav link, redirect).
  const isAdmin = computed(() => user.value?.app_metadata?.is_admin === true)

  // Phase 3 (MFA) — display/routing only, same caveat as isAdmin above:
  // requireAdmin() re-checks the real aal2 claim server-side on every admin
  // API call regardless of what these say.
  //   needsMfaEnrollment: admin, but no verified TOTP factor exists at all.
  //   needsMfaStepUp: admin, has a verified factor, but THIS session/token
  //     hasn't verified it yet (e.g. just signed in with password only).
  //   mfaSatisfied: true for non-admins (nothing to satisfy) or an aal2 admin.
  const needsMfaEnrollment = computed(() => isAdmin.value && mfaLevel.value.next !== 'aal2')
  const needsMfaStepUp = computed(() => isAdmin.value && mfaLevel.value.next === 'aal2' && mfaLevel.value.current !== 'aal2')
  const mfaSatisfied = computed(() => !isAdmin.value || mfaLevel.value.current === 'aal2')

  async function signUp(email, password) {
    const client = getClient()
    if (!client) return { error: 'Authentication is unavailable right now.' }

    const { data, error } = await client.auth.signUp({
      email: trimEmail(email),
      password,
      options: { emailRedirectTo: originUrl('/auth/callback') }
    })
    return {
      error: error?.message ?? null,
      // Confirm-email ON -> user returned, no session until they click the link.
      needsConfirmation: !error && !!data?.user && !data?.session,
      // Supabase obfuscates "email already registered" as a fake success with
      // an empty identities array.
      alreadyRegistered: !error && Array.isArray(data?.user?.identities) && data.user.identities.length === 0
    }
  }

  async function signIn(email, password) {
    const client = getClient()
    if (!client) return { error: 'Authentication is unavailable right now.' }

    const { error } = await client.auth.signInWithPassword({ email: trimEmail(email), password })
    if (error) return { error: error.message }

    markAuthenticatedNow()
    // Explicit, awaited sync rather than relying on onAuthStateChange's own
    // (unawaited, fire-and-forget) handler — the caller (AuthForm.vue) needs
    // isAdmin/needsMfaStepUp to be reliably CURRENT the instant this
    // resolves, to decide whether to show the MFA step-up prompt right now.
    await syncUserAndMfaLevel(client, user, mfaLevel)
    return { error: null }
  }

  async function signOut() {
    const client = getClient()
    if (!client) return { error: null }

    const { error } = await client.auth.signOut()
    if (!error) {
      user.value = null
      // Not load-bearing (isAdmin.value is already false once user.value is
      // null, which already makes needsMfaEnrollment/needsMfaStepUp false
      // regardless of this) — reset purely so no stale aal2 ever lingers
      // in a reactive value a future screen might read.
      mfaLevel.value = { current: null, next: null }
    }
    return { error: error?.message ?? null }
  }

  async function sendPasswordReset(email) {
    const client = getClient()
    if (!client) return { error: 'Authentication is unavailable right now.' }

    const { error } = await client.auth.resetPasswordForEmail(trimEmail(email), {
      redirectTo: originUrl('/auth/reset-password')
    })
    return { error: error?.message ?? null }
  }

  async function updatePassword(password) {
    const client = getClient()
    if (!client) return { error: 'Authentication is unavailable right now.' }

    const { error } = await client.auth.updateUser({ password })
    if (!error) markAuthenticatedNow()
    return { error: error?.message ?? null }
  }

  async function resendConfirmation(email) {
    const client = getClient()
    if (!client) return { error: 'Authentication is unavailable right now.' }

    const { error } = await client.auth.resend({ type: 'signup', email: trimEmail(email) })
    return { error: error?.message ?? null }
  }

  /** Fresh access token (JWT) for authenticating server API calls, or null. */
  async function getAccessToken() {
    const client = getClient()
    if (!client) return null

    const { data } = await client.auth.getSession()
    return data.session?.access_token ?? null
  }

  // ── Phase 3: MFA (TOTP) — admin enrollment + login step-up ──────────────

  /** Begin enrolling a new TOTP factor. Returns the QR code (SVG data URI),
   * manual-entry secret, and factorId needed to verify it. */
  async function enrollTotp(friendlyName) {
    const client = getClient()
    if (!client) return { error: 'Authentication is unavailable right now.' }

    const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName })
    if (error) return { error: error.message }
    // Supabase's own docs disagree on this: the `qr_code` field's own doc
    // comment says to prepend `data:image/svg+xml;utf-8,` yourself, but the
    // SDK's own worked example uses the raw field directly as an <Image
    // src>. Handling both: only prepend the prefix if it isn't already
    // there, so this renders correctly either way.
    const rawQr = data.totp.qr_code ?? ''
    const qrCode = rawQr.startsWith('data:') ? rawQr : `data:image/svg+xml;utf-8,${rawQr}`
    return { error: null, factorId: data.id, qrCode, secret: data.totp.secret, uri: data.totp.uri }
  }

  /** Verify a 6-digit authenticator code against a factor — used for BOTH
   * confirming a brand-new enrollment and stepping up an aal1 login to
   * aal2. Elevates the current session on success. */
  async function verifyTotp(factorId, code) {
    const client = getClient()
    if (!client) return { error: 'Authentication is unavailable right now.' }

    const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code })
    if (error) return { error: error.message }
    await refreshMfaLevel(client, mfaLevel)
    markAuthenticatedNow()
    return { error: null }
  }

  /** This account's TOTP factors (enrolled + pending), for the security page. */
  async function listTotpFactors() {
    const client = getClient()
    if (!client) return { factors: [], error: 'Authentication is unavailable right now.' }

    const { data, error } = await client.auth.mfa.listFactors()
    if (error) return { factors: [], error: error.message }
    return { factors: data.totp ?? [], error: null }
  }

  /** Remove a factor (e.g. lost device, re-enrolling). Requires the CURRENT
   * session to already be aal2 to remove a verified factor — Supabase's own
   * rule, not something this app enforces separately. */
  async function unenrollTotp(factorId) {
    const client = getClient()
    if (!client) return { error: 'Authentication is unavailable right now.' }

    const { error } = await client.auth.mfa.unenroll({ factorId })
    if (error) return { error: error.message }
    await refreshMfaLevel(client, mfaLevel)
    return { error: null }
  }

  return {
    user,
    isLoggedIn,
    isAdmin,
    authReady,
    mfaLevel,
    needsMfaEnrollment,
    needsMfaStepUp,
    mfaSatisfied,
    signUp,
    signIn,
    signOut,
    sendPasswordReset,
    updatePassword,
    resendConfirmation,
    getAccessToken,
    enrollTotp,
    verifyTotp,
    listTotpFactors,
    unenrollTotp
  }
}
