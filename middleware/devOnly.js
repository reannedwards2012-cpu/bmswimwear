/**
 * Phase 4 security hardening — pages/dev/* are internal preview/prototype
 * tools (not part of the live storefront). They're already admin-gated
 * (middleware: ['dev-only', 'admin'], requireAdmin() on their own data
 * fetches), but that alone still means the ROUTE itself exists and
 * responds in production — a signed-in admin (or anyone who later
 * compromises an admin session) could reach a tool never meant to ship.
 *
 * This runs server-side too (no `if (import.meta.server) return`,
 * deliberately unlike middleware/admin.js) so a direct request to one of
 * these URLs in production gets a real 404 in the HTTP response itself —
 * not just a client-side redirect after the page has already loaded.
 * `import.meta.dev` is a build-time constant (false in any production
 * build, regardless of NODE_ENV at runtime), so this can't be flipped by
 * an environment variable — only by building in dev mode at all.
 */
export default defineNuxtRouteMiddleware(() => {
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
  }
})
