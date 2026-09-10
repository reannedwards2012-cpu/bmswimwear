/**
 * Idle-session logout — client only. Runs after plugins/auth.client.js
 * (alphabetical order + auth is an awaited async plugin), so the Supabase
 * session is already restored and `authReady` is settled.
 *
 * Signs a CUSTOMER out after 24h of inactivity. Admin sessions are left
 * completely untouched. Guest / signed-out visitors are unaffected. The cart
 * is never touched. See utils/idleSession.js for the pure logic + rationale.
 *
 * Redirect for the "open the app cold after >24h" case is handled by
 * middleware/auth.js (synchronous, before the account page renders). This
 * plugin owns the actual Supabase sign-out + cleanup, plus the "was already on
 * the page and came back after being idle" case (tab focus / visibility).
 */
import { watch } from 'vue'
import { createIdleGuard, IDLE_KEY } from '~/utils/idleSession'

// Meaningful interaction only — NOT continuous move events (a click / tap /
// key / scroll covers "pointer activity" and keeps listener work minimal).
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'click']

export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  const { isLoggedIn, isAdmin, authReady, signOut } = useAuth()
  const router = useRouter()
  const storage = window.localStorage

  const isEligible = () => authReady.value && isLoggedIn.value && !isAdmin.value
  const isSignedIn = () => isLoggedIn.value
  const isOnProtectedRoute = () => window.location.pathname.startsWith('/account')
  const redirectToLogin = () => {
    if (window.location.pathname.startsWith('/login')) return // middleware already sent them
    const back = encodeURIComponent(window.location.pathname + window.location.search)
    return navigateTo(`/login?reason=idle&redirect=${back}`)
  }

  const guard = createIdleGuard({
    storage,
    isEligible,
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
    if (e.key === IDLE_KEY && e.newValue == null) guard.onIdleKeyClearedElsewhere()
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
  if (isEligible()) {
    guard.checkIdle().then((outcome) => {
      if (outcome !== 'expired') attach()
    })
  }

  // React to later auth changes. The getter is a BOOLEAN — it does not change
  // on a Supabase token refresh (same user, still logged in), so a refresh
  // never re-arms tracking or bumps the last-active timestamp.
  watch(
    () => authReady.value && isLoggedIn.value && !isAdmin.value,
    async (eligible) => {
      const outcome = await guard.onAuthChange()
      if (eligible && outcome !== 'expired') attach()
      else detach()
    }
  )
})
