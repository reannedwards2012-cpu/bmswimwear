/**
 * Phase 4 security hardening — baseline response headers applied to EVERY
 * request (pages and /api/* alike). Content-Security-Policy is deliberately
 * NOT set here — it needs to be computed per-rendered-page (to hash Nuxt's
 * one inline script) and is handled by server/plugins/contentSecurityPolicy.js,
 * which only fires for actual page renders.
 *
 * X-Frame-Options is a legacy fallback for browsers that don't honour CSP's
 * frame-ancestors (set alongside it, not instead of it).
 */
export default defineEventHandler((event) => {
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setResponseHeader(event, 'X-Frame-Options', 'DENY')
  // This site never uses any of these browser APIs — denying them outright
  // (empty allowlist) costs nothing and closes off a class of abuse via any
  // future third-party script.
  setResponseHeader(
    event,
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
  )
})
