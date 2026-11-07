/**
 * Protect /admin/* routes. Client-side only, same shape as middleware/auth.js
 * (`plugins/auth.client.js` is an awaited async plugin, so `authReady` is
 * settled before route middleware runs).
 *
 * This is UX only — signed-out visitors and non-admin customers are sent
 * somewhere sensible. The real security boundary is requireAdmin() on every
 * admin API route, which re-verifies admin status AND the MFA (aal2) claim
 * from the live Supabase user/token on each request (server/utils/authUser.js).
 *
 * Phase 3 (MFA): an admin session that isn't yet aal2 is redirected before
 * it ever reaches a protected admin page:
 *   - enrolled, but THIS session hasn't stepped up -> back through /login,
 *     which shows the "enter your code" step directly for an
 *     already-signed-in admin (components/AuthForm.vue) rather than asking
 *     for the password again. Applies even to /admin/security itself — you
 *     can't view/manage an already-enrolled factor without first proving
 *     you still hold it.
 *   - never enrolled a factor at all -> /admin/security to set one up (they
 *     ARE legitimately signed in at aal1 already; nothing to re-verify yet).
 *     /admin/security is specifically exempted from THIS redirect only,
 *     since it's where that gets fixed. Skipped entirely while
 *     runtimeConfig.public.adminMfaGrace is true (ADMIN_MFA_ENFORCEMENT=grace
 *     server-side, a temporary rollout aid — see authUser.js) so the client
 *     doesn't fight a server that's deliberately being lenient; the
 *     never-skipped needsMfaStepUp redirect above is unaffected either way.
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

  const { isLoggedIn, isAdmin, authReady, needsMfaEnrollment, needsMfaStepUp } = useAuth()

  if (!authReady.value) return

  if (!isLoggedIn.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
  if (!isAdmin.value) {
    return navigateTo('/account')
  }

  if (needsMfaStepUp.value) {
    return navigateTo(`/login?reason=mfa-required&redirect=${encodeURIComponent(to.fullPath)}`)
  }
  const graceMode = useRuntimeConfig().public.adminMfaGrace
  if (needsMfaEnrollment.value && to.path !== '/admin/security' && !graceMode) {
    return navigateTo('/admin/security')
  }

  const storage = typeof window !== 'undefined' ? window.localStorage : null
  const idleExpired = isIdleExpired(readLastActive(storage, ADMIN_IDLE_KEY), Date.now(), ADMIN_IDLE_TIMEOUT_MS)
  if (idleExpired) {
    return navigateTo(`/login?reason=admin-idle&redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
