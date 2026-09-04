/**
 * Protect account routes. Client-side only — the session lives in the browser
 * (localStorage), so the server render passes through and the client redirects
 * an unauthenticated visitor.
 *
 * `plugins/auth.client.js` is an awaited async plugin, so `authReady` is
 * settled before route middleware runs.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  const { isLoggedIn, authReady } = useAuth()

  if (authReady.value && !isLoggedIn.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
