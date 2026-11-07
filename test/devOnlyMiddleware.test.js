import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Phase 4 security hardening — middleware/devOnly.js, applied ahead of
 * 'admin' on pages/dev/bikini-mix-simulator.vue and
 * pages/dev/swimsuit-mixer-preview.vue. Runs server-side too (unlike
 * middleware/admin.js) so a direct request to either URL in production
 * gets a real 404 in the HTTP response, not just a client-side bounce.
 *
 * `import.meta.dev` is a Nuxt build-time constant with no vitest `define`
 * override in this suite (deliberately — unlike import.meta.client, which
 * useAuth.js needs true for other tests), so it reads as falsy here,
 * exactly matching a real production build. That's exactly the branch
 * that matters most to lock down with a regression test: the "this must
 * 404 outside dev mode" guarantee. The opposite branch (dev mode lets the
 * page through) was verified empirically against the real Nuxt dev server
 * and a real production build (curl: 200 in `npm run dev`, 404 in the
 * built-and-previewed output) rather than re-simulated here, since
 * `import.meta.dev` can't be toggled per-test the way an env var can.
 */

beforeEach(() => {
  vi.stubGlobal('defineNuxtRouteMiddleware', (fn) => fn)
  vi.stubGlobal('createError', (opts) => Object.assign(new Error(opts.statusMessage), opts))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('middleware/devOnly.js', () => {
  it('throws a fatal 404 outside dev mode', async () => {
    vi.resetModules()
    const middleware = (await import('../middleware/devOnly.js')).default

    expect(() => middleware()).toThrow()
    try {
      middleware()
    } catch (err) {
      expect(err.statusCode).toBe(404)
      expect(err.fatal).toBe(true)
    }
  })
})
