import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IDLE_KEY } from '../utils/idleSession.js'

/**
 * middleware/auth.js relies on Nuxt auto-imports + `window`. Stub them, then
 * dynamic-import the middleware.
 */
function fakeStorage(entries = {}) {
  const m = new Map(Object.entries(entries))
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}

const HOUR = 60 * 60 * 1000
let navigateTo

async function loadMiddleware({ isLoggedIn = true, isAdmin = false, authReady = true, storage } = {}) {
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
  return (await import('../middleware/auth.js')).default
}

const route = { fullPath: '/account/orders' }

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('middleware/auth.js — idle-aware account guard', () => {
  it('auth not ready → does nothing (no redirect)', async () => {
    const mw = await loadMiddleware({ authReady: false })
    expect(mw(route)).toBeUndefined()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('signed-in customer, recent activity → allowed through', async () => {
    const storage = fakeStorage({ [IDLE_KEY]: String(Date.now() - HOUR) })
    const mw = await loadMiddleware({ storage })
    expect(mw(route)).toBeUndefined()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('signed-in customer, idle > 24h → redirects to /login?reason=idle with the return path', async () => {
    const storage = fakeStorage({ [IDLE_KEY]: String(Date.now() - 25 * HOUR) })
    const mw = await loadMiddleware({ storage })
    mw(route)
    expect(navigateTo).toHaveBeenCalledWith(
      '/login?reason=idle&redirect=%2Faccount%2Forders'
    )
  })

  it('signed-out visitor → normal redirect (no idle reason)', async () => {
    const mw = await loadMiddleware({ isLoggedIn: false })
    mw(route)
    expect(navigateTo).toHaveBeenCalledWith('/login?redirect=%2Faccount%2Forders')
  })

  it('ADMIN session, idle > 24h → NOT redirected (admin auth untouched)', async () => {
    const storage = fakeStorage({ [IDLE_KEY]: String(Date.now() - 40 * HOUR) })
    const mw = await loadMiddleware({ isAdmin: true, storage })
    expect(mw(route)).toBeUndefined()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('while the expired timestamp is preserved (failed sign-out), /account stays inaccessible', async () => {
    // The idle-logout plugin leaves the expired timestamp in place when a
    // Supabase sign-out fails; the middleware keeps redirecting every attempt.
    const storage = fakeStorage({ [IDLE_KEY]: String(Date.now() - 26 * HOUR) })
    const mw = await loadMiddleware({ isLoggedIn: true, storage })
    for (const path of ['/account', '/account/orders']) {
      navigateTo.mockClear()
      mw({ fullPath: path })
      expect(navigateTo).toHaveBeenCalledWith(expect.stringContaining('/login?reason=idle'))
    }
  })
})
