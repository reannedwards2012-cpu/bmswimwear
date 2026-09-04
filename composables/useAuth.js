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

const USER_KEY = 'bm-user'
const READY_KEY = 'bm-auth-ready'

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
  } finally {
    ready.value = true
  }

  client.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user ?? null
  })
}

export function useAuth() {
  const user = useState(USER_KEY, () => null)
  const authReady = useState(READY_KEY, () => false)
  const isLoggedIn = computed(() => !!user.value)
  // Display-only. Never used for authorization — every admin API route
  // independently re-verifies app_metadata.is_admin from the live Supabase
  // user record via requireAdmin(). This just drives UX (nav link, redirect).
  const isAdmin = computed(() => user.value?.app_metadata?.is_admin === true)

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
    return { error: error?.message ?? null }
  }

  async function signOut() {
    const client = getClient()
    if (!client) return { error: null }

    const { error } = await client.auth.signOut()
    if (!error) user.value = null
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

  return {
    user,
    isLoggedIn,
    isAdmin,
    authReady,
    signUp,
    signIn,
    signOut,
    sendPasswordReset,
    updatePassword,
    resendConfirmation,
    getAccessToken
  }
}
