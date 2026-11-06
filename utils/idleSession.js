/**
 * Idle-session logout, shared by CUSTOMER and ADMIN accounts (two separate
 * guard instances, two separate storage keys, two separate timeouts — see
 * plugins/idle-logout.client.js). A signed-in user is signed out after a
 * period of INACTIVITY (not a fixed session lifetime). The source of truth
 * is a persisted "last active" timestamp in localStorage — never a
 * setTimeout, so a suspended tab / slept device is still evaluated
 * correctly on the next interaction or return.
 *
 * Pure + dependency-injected so it unit-tests directly. The browser wiring
 * (activity listeners, visibility/focus, Supabase sign-out, route redirect)
 * lives in plugins/idle-logout.client.js, middleware/auth.js (customer) and
 * middleware/admin.js (admin).
 *
 * Customers: 24h (IDLE_KEY / IDLE_TIMEOUT_MS). Admins: 30 minutes
 * (ADMIN_IDLE_KEY / ADMIN_IDLE_TIMEOUT_MS) — a shorter window is
 * appropriate given admin sessions can modify/delete business data. Every
 * exported helper defaults its `key` parameter to IDLE_KEY, so every
 * existing call site (and this file's own pre-existing tests) is
 * byte-for-byte unaffected; only the admin guard passes ADMIN_IDLE_KEY
 * explicitly.
 */

// Bahama Mama-namespaced keys. NOT the Supabase session key (supabase-js
// owns that and handles its own cross-tab sign-out propagation).
export const IDLE_KEY = 'bms_auth_last_active'
export const ADMIN_IDLE_KEY = 'bms_admin_last_active'

export const IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000 // 24h
export const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
// Don't touch localStorage more than once a minute for activity — cheap and
// still far finer-grained than either window above.
export const ACTIVITY_THROTTLE_MS = 60 * 1000
// Admin-only: how long before the 30-minute timeout a "continue session?"
// warning is shown (Phase 1 security hardening — admins can have unsaved
// form data, so expiry must never be silent). Not used by the customer
// guard at all.
export const ADMIN_IDLE_WARNING_MS = 2 * 60 * 1000

/**
 * Pure: milliseconds remaining before an idle guard would expire, or null
 * when there's no timestamp to measure against yet (not yet seeded).
 * Can be negative — callers treat <= 0 as "already expired".
 */
export function msUntilIdleExpiry(lastActive, nowTs, timeoutMs = IDLE_TIMEOUT_MS) {
  if (typeof lastActive !== 'number' || !Number.isFinite(lastActive)) return null
  return timeoutMs - (nowTs - lastActive)
}

// ── persisted timestamp (every access wrapped — storage throws in some modes) ──
export function readLastActive(storage, key = IDLE_KEY) {
  try {
    const raw = storage && storage.getItem(key)
    if (raw == null) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export function writeLastActive(storage, ts, key = IDLE_KEY) {
  try {
    storage && storage.setItem(key, String(ts))
  } catch {
    /* private mode / quota — idle logout simply degrades to off (fail-open) */
  }
}

export function clearLastActive(storage, key = IDLE_KEY) {
  try {
    storage && storage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** True only when a real stored timestamp exists AND is >= the timeout old. */
export function isIdleExpired(lastActive, nowTs, timeoutMs = IDLE_TIMEOUT_MS) {
  return (
    typeof lastActive === 'number' &&
    Number.isFinite(lastActive) &&
    nowTs - lastActive >= timeoutMs
  )
}

/**
 * Framework-agnostic idle guard.
 *
 * @param {{
 *   storage: Storage,
 *   now?: () => number,
 *   throttleMs?: number,
 *   timeoutMs?: number,
 *   key?: string,                    // defaults to IDLE_KEY — pass ADMIN_IDLE_KEY for the admin guard
 *   isEligible: () => boolean,       // signed-in AND the role this guard covers
 *   isSignedIn: () => boolean,       // any Supabase session (customer or admin)
 *   signOut: () => Promise<any>,     // the existing useAuth().signOut
 *   isOnProtectedRoute: () => boolean,
 *   redirectToLogin: () => any       // navigate to /login (only when protected)
 * }} deps
 */
export function createIdleGuard(deps) {
  const now = deps.now || (() => Date.now())
  const throttleMs = deps.throttleMs ?? ACTIVITY_THROTTLE_MS
  const timeoutMs = deps.timeoutMs ?? IDLE_TIMEOUT_MS
  const key = deps.key ?? IDLE_KEY

  let lastWrite = 0
  let signingOut = false

  /**
   * Record MEANINGFUL user activity (pointer / key / touch / scroll / nav /
   * tab-return). Throttled. Never called for a Supabase token refresh, so a
   * background refresh does not extend the idle window on its own.
   */
  function recordActivity() {
    if (signingOut || !deps.isEligible()) return
    const t = now()
    if (t - lastWrite < throttleMs) return
    lastWrite = t
    writeLastActive(deps.storage, t, key)
  }

  async function signOutIdle() {
    if (signingOut) return
    signingOut = true
    try {
      let signedOut = false
      try {
        const res = await deps.signOut()
        // useAuth().signOut resolves { error: string|null }
        signedOut = !res || res.error == null
      } catch {
        signedOut = false
      }

      // Clear the idle timestamp ONLY once the session has actually transitioned
      // out — either sign-out reported success, or the auth state is now signed
      // out regardless. If sign-out FAILED and the session is still
      // authenticated, LEAVE the expired timestamp in place so the next
      // visibility / focus / navigation check retries logout. No fresh 24h
      // window is granted just because a sign-out call failed.
      if (signedOut || !deps.isSignedIn()) {
        clearLastActive(deps.storage, key)
        lastWrite = 0
      }

      // Redirect regardless: the middleware keeps an expired session off
      // /account while the timestamp is still there, and this gets the customer
      // off a protected page immediately.
      try {
        if (deps.isOnProtectedRoute()) await deps.redirectToLogin()
      } catch {
        /* ignore navigation errors */
      }
    } finally {
      signingOut = false
    }
  }

  /**
   * The source-of-truth check. Call on init, tab-visible, window focus,
   * pageshow and navigation.
   * @returns {'skip'|'seeded'|'active'|'expired'}
   */
  async function checkIdle() {
    if (signingOut || !deps.isEligible()) return 'skip'

    const last = readLastActive(deps.storage, key)
    if (last == null) {
      // Signed in but no timestamp yet — fresh login, first run after this
      // deploy, or storage was cleared. Start the clock now (NOT an activity
      // bump; just seeding).
      lastWrite = now()
      writeLastActive(deps.storage, lastWrite, key)
      return 'seeded'
    }

    if (isIdleExpired(last, now(), timeoutMs)) {
      await signOutIdle()
      return 'expired'
    }
    return 'active'
  }

  /** Auth state changed (login / logout / became-admin). */
  async function onAuthChange() {
    if (deps.isEligible()) return checkIdle()
    // Not an eligible customer session any more. If the whole session is gone
    // (manual sign out / idle sign out), drop our key too.
    if (!deps.isSignedIn()) clearLastActive(deps.storage, key)
    lastWrite = 0
    return 'skip'
  }

  /** Another tab removed the idle key (it idle-signed-out) — mirror it here. */
  async function onIdleKeyClearedElsewhere() {
    if (deps.isEligible()) await signOutIdle()
  }

  return { recordActivity, checkIdle, onAuthChange, onIdleKeyClearedElsewhere, signOutIdle }
}
