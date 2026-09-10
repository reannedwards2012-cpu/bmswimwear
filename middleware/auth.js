/**
 * Protect account routes. Client-side only — the session lives in the browser
 * (localStorage), so the server render passes through and the client redirects
 * an unauthenticated visitor.
 *
 * `plugins/auth.client.js` is an awaited async plugin, so `authReady` is
 * settled before route middleware runs.
 *
 * Also enforces the 24h idle-logout for CUSTOMER sessions on protected-route
 * navigation (defence in depth — the actual Supabase sign-out + cleanup is
 * done by plugins/idle-logout.client.js). Admin sessions are not affected.
 */
import { readLastActive, isIdleExpired } from '~/utils/idleSession'

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  const { isLoggedIn, isAdmin, authReady } = useAuth()

  if (!authReady.value) return

  const storage = typeof window !== 'undefined' ? window.localStorage : null
  const idleExpired =
    isLoggedIn.value &&
    !isAdmin.value &&
    isIdleExpired(readLastActive(storage), Date.now())

  if (!isLoggedIn.value || idleExpired) {
    const redirect = `redirect=${encodeURIComponent(to.fullPath)}`
    return navigateTo(idleExpired ? `/login?reason=idle&${redirect}` : `/login?${redirect}`)
  }
})
