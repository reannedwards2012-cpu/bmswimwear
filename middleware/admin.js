/**
 * Protect /admin/* routes. Client-side only, same shape as middleware/auth.js
 * (`plugins/auth.client.js` is an awaited async plugin, so `authReady` is
 * settled before route middleware runs).
 *
 * This is UX only — signed-out visitors and non-admin customers are sent
 * somewhere sensible. The real security boundary is requireAdmin() on every
 * admin API route, which re-verifies admin status from the live Supabase
 * user record on each request.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  const { isLoggedIn, isAdmin, authReady } = useAuth()

  if (!authReady.value) return

  if (!isLoggedIn.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
  if (!isAdmin.value) {
    return navigateTo('/account')
  }
})
