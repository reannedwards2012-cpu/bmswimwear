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

async function loadMiddleware({ isLoggedIn = true, isAdmin = true, authReady = true, storage } = {}) {
  navigateTo = vi.fn((x) => ({ __redirect: x }))
  vi.stubGlobal('defineNuxtRouteMiddleware', (fn) => fn)
  vi.stubGlobal('navigateTo', navigateTo)
  vi.stubGlobal('useAuth', () => ({
    isLoggedIn: { value: isLoggedIn },
    isAdmin: { value: isAdmin },
    authReady: { value: authReady }
  }))
  vi.stubGlobal('window', { localStorage: storage || fakeStorage() })
  vi.resetModules()
  return (await import('../middleware/admin.js')).default
}

const route = { fullPath: '/admin/orders' }

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
