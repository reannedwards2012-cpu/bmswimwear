/**
 * Idle-session logout — client only. Runs after plugins/auth.client.js
 * (alphabetical order + auth is an awaited async plugin), so the Supabase
 * session is already restored and `authReady` is settled.
 *
 * Two completely independent guards share the same wiring (via setupGuard
 * below), each created from createIdleGuard (utils/idleSession.js):
 *   - CUSTOMER: 24h of inactivity, protects /account, redirects with
 *     ?reason=idle. Unchanged from before this guard became reusable.
 *   - ADMIN: 30 minutes of inactivity, protects /admin, redirects with
 *     ?reason=admin-idle. New — admin sessions were previously excluded
 *     entirely (Phase 1 security hardening).
 * A signed-in user is only ever eligible for ONE of the two at a time
 * (isAdmin is mutually exclusive with the customer guard's eligibility), so
 * they never fight over the same session. Guest / signed-out visitors are
 * unaffected by either. The cart is never touched by either guard.
 *
 * Redirect for the "open the app cold after the window expired" case is
 * handled by middleware/auth.js (customer) / middleware/admin.js (admin) —
 * synchronous, before the protected page renders. This plugin owns the
 * actual Supabase sign-out + cleanup, plus the "was already on the page and
 * came back after being idle" case (tab focus / visibility).
 */
import { watch } from 'vue'
import {
  createIdleGuard,
  readLastActive,
  msUntilIdleExpiry,
  IDLE_KEY,
  IDLE_TIMEOUT_MS,
  ADMIN_IDLE_KEY,
  ADMIN_IDLE_TIMEOUT_MS,
  ADMIN_IDLE_WARNING_MS
} from '~/utils/idleSession'

// How often the admin guard polls to see whether it should show/update the
// "continue session?" warning. Deliberately NOT event-driven like the rest
// of this guard (activity/visibility/focus/nav) — the warning must appear
// even if the admin is simply reading the page and never triggers one of
// those events, otherwise it could never fire before the actual timeout.
const ADMIN_WARNING_POLL_MS = 5 * 1000

// Meaningful interaction only — NOT continuous move events (a click / tap /
// key / scroll covers "pointer activity" and keeps listener work minimal).
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'click']

/**
 * Wires one idle guard's full browser lifecycle: activity listeners,
 * visibility/focus/pageshow re-checks, cross-tab key-cleared mirroring,
 * router-navigation checkpoints, and attach/detach as eligibility changes.
 *
 * @param {{
 *   storage: Storage,
 *   idleKey: string,
 *   timeoutMs: number,
 *   isEligibleRef: () => boolean,     // reactive-read, re-evaluated on every call
 *   isSignedIn: () => boolean,
 *   signOut: () => Promise<any>,
 *   isOnProtectedRoute: () => boolean,
 *   reason: string,                   // ?reason= value on the redirect
 *   router: ReturnType<typeof useRouter>
 * }} config
 */
function setupGuard(config) {
  const { storage, idleKey, timeoutMs, isEligibleRef, isSignedIn, signOut, isOnProtectedRoute, reason, router } = config

  const redirectToLogin = () => {
    if (window.location.pathname.startsWith('/login')) return // middleware already sent them
    const back = encodeURIComponent(window.location.pathname + window.location.search)
    return navigateTo(`/login?reason=${reason}&redirect=${back}`)
  }

  const guard = createIdleGuard({
    storage,
    key: idleKey,
    timeoutMs,
    isEligible: isEligibleRef,
    isSignedIn,
    signOut,
    isOnProtectedRoute,
    redirectToLogin
  })

  const onActivity = () => guard.recordActivity()
  const onVisible = () => {
    if (document.visibilityState === 'visible') guard.checkIdle()
  }
  const onFocus = () => guard.checkIdle()
  const onStorage = (e) => {
    if (e.key === idleKey && e.newValue == null) guard.onIdleKeyClearedElsewhere()
  }

  let attached = false
  function attach() {
    if (attached) return
    attached = true
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { passive: true })
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onVisible)
    window.addEventListener('storage', onStorage)
  }
  function detach() {
    if (!attached) return
    attached = false
    for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('pageshow', onVisible)
    window.removeEventListener('storage', onStorage)
  }

  // Navigation is activity AND a checkpoint (covers a suspended-then-resumed
  // tab whose first action is a route change).
  router.afterEach(() => {
    guard.checkIdle().then((r) => {
      if (r === 'active') guard.recordActivity()
    })
  })

  // Initial evaluation for a session that's already restored on page load.
  if (isEligibleRef()) {
    guard.checkIdle().then((outcome) => {
      if (outcome !== 'expired') attach()
    })
  }

  return { guard, attach, detach }
}

export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  const { isLoggedIn, isAdmin, authReady, signOut } = useAuth()
  const router = useRouter()
  const storage = window.localStorage
  const isSignedIn = () => isLoggedIn.value

  const customer = setupGuard({
    storage,
    idleKey: IDLE_KEY,
    timeoutMs: IDLE_TIMEOUT_MS,
    isEligibleRef: () => authReady.value && isLoggedIn.value && !isAdmin.value,
    isSignedIn,
    signOut,
    isOnProtectedRoute: () => window.location.pathname.startsWith('/account'),
    reason: 'idle',
    router
  })

  const admin = setupGuard({
    storage,
    idleKey: ADMIN_IDLE_KEY,
    timeoutMs: ADMIN_IDLE_TIMEOUT_MS,
    isEligibleRef: () => authReady.value && isLoggedIn.value && isAdmin.value,
    isSignedIn,
    signOut,
    isOnProtectedRoute: () => window.location.pathname.startsWith('/admin'),
    reason: 'admin-idle',
    router
  })

  // Admin-only "continue session?" warning (Phase 1 security hardening).
  // Shared reactive state so AdminIdleWarningModal.vue (rendered from
  // layouts/admin.vue, nowhere near this plugin) can read it; $adminIdleGuard
  // is how that modal's "Continue session" button extends the session
  // without this plugin needing to know the modal exists.
  const adminIdleWarning = useState('adminIdleWarning', () => ({ show: false, expiresAt: 0 }))
  useNuxtApp().provide('adminIdleGuard', admin.guard)

  let warningPoll = null
  function pollAdminWarning() {
    if (!(authReady.value && isLoggedIn.value && isAdmin.value)) {
      if (adminIdleWarning.value.show) adminIdleWarning.value = { show: false, expiresAt: 0 }
      return
    }
    const last = readLastActive(storage, ADMIN_IDLE_KEY)
    const remaining = msUntilIdleExpiry(last, Date.now(), ADMIN_IDLE_TIMEOUT_MS)
    if (remaining == null) return // not seeded yet
    if (remaining <= 0) {
      if (adminIdleWarning.value.show) adminIdleWarning.value = { show: false, expiresAt: 0 }
      admin.guard.checkIdle() // the usual event-driven checks might not fire if the tab sat idle+focused the whole time
      return
    }
    if (remaining <= ADMIN_IDLE_WARNING_MS) {
      const expiresAt = Date.now() + remaining
      if (!adminIdleWarning.value.show) adminIdleWarning.value = { show: true, expiresAt }
    } else if (adminIdleWarning.value.show) {
      adminIdleWarning.value = { show: false, expiresAt: 0 }
    }
  }
  function startWarningPoll() {
    if (warningPoll) return
    warningPoll = window.setInterval(pollAdminWarning, ADMIN_WARNING_POLL_MS)
    pollAdminWarning()
  }
  function stopWarningPoll() {
    if (!warningPoll) return
    window.clearInterval(warningPoll)
    warningPoll = null
    if (adminIdleWarning.value.show) adminIdleWarning.value = { show: false, expiresAt: 0 }
  }

  // React to later auth changes. The getters are BOOLEANs — they do not
  // change on a Supabase token refresh (same user, still logged in), so a
  // refresh never re-arms tracking or bumps either last-active timestamp.
  watch(
    () => authReady.value && isLoggedIn.value && !isAdmin.value,
    async (eligible) => {
      const outcome = await customer.guard.onAuthChange()
      if (eligible && outcome !== 'expired') customer.attach()
      else customer.detach()
    }
  )
  watch(
    () => authReady.value && isLoggedIn.value && isAdmin.value,
    async (eligible) => {
      const outcome = await admin.guard.onAuthChange()
      if (eligible && outcome !== 'expired') {
        admin.attach()
        startWarningPoll()
      } else {
        admin.detach()
        stopWarningPoll()
      }
    }
  )

  if (authReady.value && isLoggedIn.value && isAdmin.value) startWarningPoll()
})
