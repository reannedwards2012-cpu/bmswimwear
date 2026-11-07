import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ADMIN_IDLE_KEY } from '../utils/idleSession.js'

/**
 * middleware/admin.js relies on Nuxt auto-imports + `window`. Stub them,
 * then dynamic-import the middleware. Mirrors test/idleMiddleware.test.js's
 * approach for middleware/auth.js exactly.
 */
function fakeStorage(entries = {}) {
  return {
    _m: new Map(Object.entries(entries)),
    getItem(k) {
      return this._m.has(k) ? this._m.get(k) : null
    },
    setItem(k, v) {
      this._m.set(k, String(v))
    },
    removeItem(k) {
      this._m.delete(k)
    }
  }
}

const MINUTE = 60 * 1000
let navigateTo

async function loadMiddleware({
  isLoggedIn = true,
  isAdmin = true,
  authReady = true,
  needsMfaEnrollment = false,
  needsMfaStepUp = false,
  adminMfaGrace = false,
  storage
} = {}) {
  navigateTo = vi.fn((x) => ({ __redirect: x }))
  vi.stubGlobal('defineNuxtRouteMiddleware', (fn) => fn)
  vi.stubGlobal('navigateTo', navigateTo)
  vi.stubGlobal('useAuth', () => ({
    isLoggedIn: { value: isLoggedIn },
    isAdmin: { value: isAdmin },
    authReady: { value: authReady },
    needsMfaEnrollment: { value: needsMfaEnrollment },
    needsMfaStepUp: { value: needsMfaStepUp }
  }))
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { adminMfaGrace } }))
  vi.stubGlobal('window', { localStorage: storage || fakeStorage() })
  vi.resetModules()
  return (await import('../middleware/admin.js')).default
}

const route = { fullPath: '/admin/orders', path: '/admin/orders' }
const securityRoute = { fullPath: '/admin/security', path: '/admin/security' }

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('middleware/admin.js — idle-aware admin guard (Phase 1 security hardening)', () => {
  it('auth not ready → does nothing (no redirect)', async () => {
    const mw = await loadMiddleware({ authReady: false })
    expect(mw(route)).toBeUndefined()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('signed-out visitor → normal redirect, no idle reason', async () => {
    const mw = await loadMiddleware({ isLoggedIn: false })
    mw(route)
    expect(navigateTo).toHaveBeenCalledWith(`/login?redirect=${encodeURIComponent(route.fullPath)}`)
  })

  it('signed-in but NOT an admin → sent to /account, not treated as an idle admin', async () => {
    const mw = await loadMiddleware({ isAdmin: false })
    mw(route)
    expect(navigateTo).toHaveBeenCalledWith('/account')
  })

  it('admin, recent activity (well under 30min) → allowed through', async () => {
    const storage = fakeStorage({ [ADMIN_IDLE_KEY]: String(Date.now() - 5 * MINUTE) })
    const mw = await loadMiddleware({ storage })
    expect(mw(route)).toBeUndefined()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('admin idle > 30 minutes → redirected to /login?reason=admin-idle with the return path', async () => {
    const storage = fakeStorage({ [ADMIN_IDLE_KEY]: String(Date.now() - 31 * MINUTE) })
    const mw = await loadMiddleware({ storage })
    mw(route)
    expect(navigateTo).toHaveBeenCalledWith('/login?reason=admin-idle&redirect=%2Fadmin%2Forders')
  })

  it('admin idle at exactly 29 minutes → still allowed (not yet at the 30-minute boundary)', async () => {
    const storage = fakeStorage({ [ADMIN_IDLE_KEY]: String(Date.now() - 29 * MINUTE) })
    const mw = await loadMiddleware({ storage })
    expect(mw(route)).toBeUndefined()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('no admin idle timestamp yet (fresh login) → allowed through, never treated as expired', async () => {
    const mw = await loadMiddleware({ storage: fakeStorage() })
    expect(mw(route)).toBeUndefined()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('a long-idle CUSTOMER key does not affect the admin check — separate storage keys', async () => {
    const storage = fakeStorage({ 'bms_auth_last_active': String(Date.now() - 40 * 60 * MINUTE) })
    const mw = await loadMiddleware({ storage })
    expect(mw(route)).toBeUndefined()
    expect(navigateTo).not.toHaveBeenCalled()
  })
})

describe('middleware/admin.js — MFA (Phase 3) gating', () => {
  it('admin who has never enrolled MFA → redirected to /admin/security (not /login — they are legitimately signed in)', async () => {
    const mw = await loadMiddleware({ needsMfaEnrollment: true })
    mw(route)
    expect(navigateTo).toHaveBeenCalledWith('/admin/security')
  })

  it('admin enrolled but this session has not stepped up → redirected through /login?reason=mfa-required with the return path', async () => {
    const mw = await loadMiddleware({ needsMfaStepUp: true })
    mw(route)
    expect(navigateTo).toHaveBeenCalledWith('/login?reason=mfa-required&redirect=%2Fadmin%2Forders')
  })

  it('/admin/security itself is reachable even when enrollment is still pending — no redirect loop', async () => {
    const mw = await loadMiddleware({ needsMfaEnrollment: true })
    expect(mw(securityRoute)).toBeUndefined()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('step-up ALWAYS takes priority, even for /admin/security itself — you cannot view/manage an already-enrolled factor without proving you still hold it', async () => {
    const mw = await loadMiddleware({ needsMfaStepUp: true })
    mw(securityRoute)
    expect(navigateTo).toHaveBeenCalledWith('/login?reason=mfa-required&redirect=%2Fadmin%2Fsecurity')
  })

  it('MFA fully satisfied (both false) → normal idle-aware flow, unaffected', async () => {
    const mw = await loadMiddleware({})
    expect(mw(route)).toBeUndefined()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('MFA step-up takes priority over an idle redirect — the more specific problem is surfaced first', async () => {
    const storage = fakeStorage({ [ADMIN_IDLE_KEY]: String(Date.now() - 31 * MINUTE) })
    const mw = await loadMiddleware({ needsMfaStepUp: true, storage })
    mw(route)
    expect(navigateTo).toHaveBeenCalledWith('/login?reason=mfa-required&redirect=%2Fadmin%2Forders')
    expect(navigateTo).toHaveBeenCalledTimes(1)
  })
})

describe('middleware/admin.js — ADMIN_MFA_ENFORCEMENT=grace (rollout aid, reflected client-side via runtimeConfig.public.adminMfaGrace)', () => {
  it('in grace mode, a never-enrolled admin is let through to ANY admin page — not forced to /admin/security', async () => {
    const mw = await loadMiddleware({ needsMfaEnrollment: true, adminMfaGrace: true })
    expect(mw(route)).toBeUndefined()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('grace mode NEVER skips the step-up redirect — an already-enrolled admin still must verify this session, exactly as in strict mode', async () => {
    const mw = await loadMiddleware({ needsMfaStepUp: true, adminMfaGrace: true })
    mw(route)
    expect(navigateTo).toHaveBeenCalledWith('/login?reason=mfa-required&redirect=%2Fadmin%2Forders')
  })

  it('without grace mode (default), a never-enrolled admin is still forced to /admin/security — grace is opt-in only', async () => {
    const mw = await loadMiddleware({ needsMfaEnrollment: true, adminMfaGrace: false })
    mw(route)
    expect(navigateTo).toHaveBeenCalledWith('/admin/security')
  })

  it('the idle-logout check still applies even in grace mode', async () => {
    const storage = fakeStorage({ [ADMIN_IDLE_KEY]: String(Date.now() - 31 * MINUTE) })
    const mw = await loadMiddleware({ needsMfaEnrollment: true, adminMfaGrace: true, storage })
    mw(route)
    expect(navigateTo).toHaveBeenCalledWith('/login?reason=admin-idle&redirect=%2Fadmin%2Forders')
  })
})
