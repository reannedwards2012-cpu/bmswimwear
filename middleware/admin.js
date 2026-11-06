/**
 * Protect /admin/* routes. Client-side only, same shape as middleware/auth.js
 * (`plugins/auth.client.js` is an awaited async plugin, so `authReady` is
 * settled before route middleware runs).
 *
 * This is UX only — signed-out visitors and non-admin customers are sent
 * somewhere sensible. The real security boundary is requireAdmin() on every
 * admin API route, which re-verifies admin status from the live Supabase
 * user record on each request.
 *
 * Also enforces the 30-minute idle-logout for ADMIN sessions on protected-
 * route navigation (defence in depth — the actual Supabase sign-out +
 * cleanup is done by plugins/idle-logout.client.js) — same "cold open after
 * expiry" pattern middleware/auth.js already uses for customers, just a
 * shorter window and a separate storage key (utils/idleSession.js).
 */
import { readLastActive, isIdleExpired, ADMIN_IDLE_KEY, ADMIN_IDLE_TIMEOUT_MS } from '~/utils/idleSession'

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

  const storage = typeof window !== 'undefined' ? window.localStorage : null
  const idleExpired = isIdleExpired(readLastActive(storage, ADMIN_IDLE_KEY), Date.now(), ADMIN_IDLE_TIMEOUT_MS)
  if (idleExpired) {
    return navigateTo(`/login?reason=admin-idle&redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
