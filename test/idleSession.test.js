import { describe, it, expect, vi } from 'vitest'
import {
  IDLE_KEY,
  IDLE_TIMEOUT_MS,
  ACTIVITY_THROTTLE_MS,
  readLastActive,
  writeLastActive,
  clearLastActive,
  isIdleExpired,
  createIdleGuard
} from '../utils/idleSession.js'

// ── a real Map-backed localStorage stand-in (so we can also check the CART key) ──
function fakeStorage(initial = {}) {
  const m = new Map(Object.entries(initial))
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m
  }
}
const throwingStorage = {
  getItem() {
    throw new Error('SecurityError')
  },
  setItem() {
    throw new Error('SecurityError')
  },
  removeItem() {
    throw new Error('SecurityError')
  }
}

const HOUR = 60 * 60 * 1000

describe('isIdleExpired — 24h inactivity, not a fixed lifetime', () => {
  const now = 1_000_000_000_000
  it.each([
    ['1 hour ago', now - HOUR, false],
    ['23h59m ago', now - (24 * HOUR - 60_000), false],
    ['exactly 24h ago', now - IDLE_TIMEOUT_MS, true],
    ['25 hours ago', now - 25 * HOUR, true]
  ])('%s → expired=%s', (_label, last, expected) => {
    expect(isIdleExpired(last, now)).toBe(expected)
  })

  it('no / invalid timestamp is never "expired" (a fresh session is not idle)', () => {
    expect(isIdleExpired(null, now)).toBe(false)
    expect(isIdleExpired(undefined, now)).toBe(false)
    expect(isIdleExpired(NaN, now)).toBe(false)
    expect(isIdleExpired('nope', now)).toBe(false)
  })
})

describe('storage helpers', () => {
  it('round-trips the namespaced key', () => {
    const s = fakeStorage()
    writeLastActive(s, 12345)
    expect(s.getItem(IDLE_KEY)).toBe('12345')
    expect(readLastActive(s)).toBe(12345)
    clearLastActive(s)
    expect(readLastActive(s)).toBeNull()
  })
  it('garbage in storage → null', () => {
    expect(readLastActive(fakeStorage({ [IDLE_KEY]: 'garbage' }))).toBeNull()
  })
  it('throwing storage (private mode) degrades gracefully, never throws', () => {
    expect(() => writeLastActive(throwingStorage, 1)).not.toThrow()
    expect(() => clearLastActive(throwingStorage)).not.toThrow()
    expect(readLastActive(throwingStorage)).toBeNull()
  })
})

// ── createIdleGuard ──────────────────────────────────────────────────────
function setup(over = {}) {
  const storage = over.storage || fakeStorage({ 'bm-cart': '[{"lineId":"x"}]' })
  const clock = { t: 5_000_000_000_000 }
  const signOut = over.signOut || vi.fn(async () => ({ error: null }))
  const redirectToLogin = over.redirectToLogin || vi.fn()
  const deps = {
    storage,
    now: () => clock.t,
    isEligible: over.isEligible || (() => true),
    isSignedIn: over.isSignedIn || (() => true),
    signOut,
    isOnProtectedRoute: over.isOnProtectedRoute || (() => true),
    redirectToLogin,
    ...(over.throttleMs ? { throttleMs: over.throttleMs } : {})
  }
  return { guard: createIdleGuard(deps), storage, clock, signOut, redirectToLogin }
}

describe('createIdleGuard — activity tracking', () => {
  it('records activity for an eligible customer (writes the timestamp)', () => {
    const { guard, storage, clock } = setup()
    guard.recordActivity()
    expect(readLastActive(storage)).toBe(clock.t)
  })

  it('throttles: a second activity inside the window does not re-write', () => {
    const { guard, storage, clock } = setup()
    guard.recordActivity()
    const first = readLastActive(storage)
    clock.t += ACTIVITY_THROTTLE_MS - 1
    guard.recordActivity()
    expect(readLastActive(storage)).toBe(first)
    clock.t += 2 // now past the throttle window
    guard.recordActivity()
    expect(readLastActive(storage)).toBe(clock.t)
  })

  it('does NOT record activity for a signed-out / guest visitor', () => {
    const { guard, storage } = setup({ isEligible: () => false })
    guard.recordActivity()
    expect(readLastActive(storage)).toBeNull()
  })

  it('does NOT record activity for an admin session (admin auth untouched)', () => {
    const { guard, storage } = setup({ isEligible: () => false, isSignedIn: () => true })
    guard.recordActivity()
    expect(readLastActive(storage)).toBeNull()
  })
})

describe('createIdleGuard — checkIdle', () => {
  it('signed in, no timestamp → seeds "now", stays signed in', async () => {
    const { guard, storage, clock, signOut } = setup()
    expect(await guard.checkIdle()).toBe('seeded')
    expect(readLastActive(storage)).toBe(clock.t)
    expect(signOut).not.toHaveBeenCalled()
  })

  it('active < 24h ago → "active", timestamp is NOT bumped (passive check ≠ activity)', async () => {
    const { guard, storage, clock, signOut } = setup()
    writeLastActive(storage, clock.t - 2 * HOUR)
    expect(await guard.checkIdle()).toBe('active')
    expect(readLastActive(storage)).toBe(clock.t - 2 * HOUR) // unchanged
    expect(signOut).not.toHaveBeenCalled()
  })

  it('idle ≥ 24h + SUCCESSFUL sign-out → "expired": signs out, clears the idle key, redirects', async () => {
    const { guard, storage, clock, signOut, redirectToLogin } = setup()
    writeLastActive(storage, clock.t - 25 * HOUR)
    expect(await guard.checkIdle()).toBe('expired')
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(readLastActive(storage)).toBeNull()
    expect(redirectToLogin).toHaveBeenCalledTimes(1)
  })

  it('idle ≥ 24h but NOT on a protected route → signs out, no redirect', async () => {
    const { guard, storage, clock, signOut, redirectToLogin } = setup({ isOnProtectedRoute: () => false })
    writeLastActive(storage, clock.t - 30 * HOUR)
    expect(await guard.checkIdle()).toBe('expired')
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(redirectToLogin).not.toHaveBeenCalled()
  })

  it('not eligible → "skip", touches nothing', async () => {
    const { guard, storage, signOut } = setup({ isEligible: () => false })
    writeLastActive(storage, 1)
    expect(await guard.checkIdle()).toBe('skip')
    expect(signOut).not.toHaveBeenCalled()
  })

  it('idle ≥ 24h + FAILED sign-out, session still authenticated → expired timestamp is PRESERVED', async () => {
    const signOut = vi.fn(async () => ({ error: 'network' })) // useAuth-shape failure
    const { guard, storage, clock, redirectToLogin } = setup({ signOut, isSignedIn: () => true })
    const expiredTs = clock.t - 25 * HOUR
    writeLastActive(storage, expiredTs)

    await expect(guard.checkIdle()).resolves.toBe('expired')
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(readLastActive(storage)).toBe(expiredTs) // NOT cleared, NOT reseeded
    expect(redirectToLogin).toHaveBeenCalledTimes(1) // still gets them off /account
  })

  it('a thrown sign-out with the session still authenticated → expired timestamp PRESERVED, never throws', async () => {
    const signOut = vi.fn(async () => {
      throw new Error('boom')
    })
    const { guard, storage, clock } = setup({ signOut, isSignedIn: () => true })
    const expiredTs = clock.t - 40 * HOUR
    writeLastActive(storage, expiredTs)
    await expect(guard.checkIdle()).resolves.toBe('expired')
    expect(readLastActive(storage)).toBe(expiredTs)
  })

  it('failed sign-out BUT the auth state is actually signed out → timestamp cleared (correct)', async () => {
    const signOut = vi.fn(async () => ({ error: 'revoke failed' }))
    const { guard, storage, clock } = setup({ signOut, isSignedIn: () => false })
    writeLastActive(storage, clock.t - 25 * HOUR)
    await guard.checkIdle()
    expect(readLastActive(storage)).toBeNull()
  })

  it('after a failed sign-out, the NEXT idle check retries sign-out (no fresh 24h window)', async () => {
    const signOut = vi.fn(async () => ({ error: 'still down' }))
    const { guard, storage, clock } = setup({ signOut, isSignedIn: () => true })
    const expiredTs = clock.t - 26 * HOUR
    writeLastActive(storage, expiredTs)

    // 1st trigger (e.g. visibility)
    expect(await guard.checkIdle()).toBe('expired')
    // 2nd trigger (e.g. focus / navigation) — timestamp is still the old expired
    // value, so it re-evaluates as expired and tries again. It is NEVER seeded.
    expect(await guard.checkIdle()).toBe('expired')
    expect(signOut).toHaveBeenCalledTimes(2)
    expect(readLastActive(storage)).toBe(expiredTs)

    // Once sign-out finally succeeds → cleared.
    signOut.mockResolvedValueOnce({ error: null })
    expect(await guard.checkIdle()).toBe('expired')
    expect(readLastActive(storage)).toBeNull()
  })

  it('a genuine re-authentication (fresh last-active write) recovers a stuck session', async () => {
    const signOut = vi.fn(async () => ({ error: 'down' }))
    const { guard, storage, clock } = setup({ signOut, isSignedIn: () => true })
    writeLastActive(storage, clock.t - 30 * HOUR)
    await guard.checkIdle() // fails, timestamp preserved (expired)

    // useAuth.signIn / updatePassword success writes a fresh timestamp:
    writeLastActive(storage, clock.t)
    expect(await guard.checkIdle()).toBe('active') // no longer expired
    expect(signOut).toHaveBeenCalledTimes(1) // not signed out again
  })

  it('idle sign-out only removes the idle key — the cart is left alone', async () => {
    const { guard, storage, clock } = setup()
    writeLastActive(storage, clock.t - 25 * HOUR)
    await guard.checkIdle()
    expect(storage.getItem('bm-cart')).toBe('[{"lineId":"x"}]') // untouched
  })
})

describe('createIdleGuard — auth changes', () => {
  it('became eligible (login) → runs checkIdle (seeds the clock)', async () => {
    const { guard, storage, clock } = setup()
    expect(await guard.onAuthChange()).toBe('seeded')
    expect(readLastActive(storage)).toBe(clock.t)
  })

  it('manual sign out (no session) → clears idle tracking', async () => {
    const { guard, storage } = setup({ isEligible: () => false, isSignedIn: () => false })
    writeLastActive(storage, Date.now())
    await guard.onAuthChange()
    expect(readLastActive(storage)).toBeNull()
  })

  it('still signed in but not eligible (admin) → does NOT clear the key', async () => {
    const s = fakeStorage()
    writeLastActive(s, 999)
    const { guard } = setup({ storage: s, isEligible: () => false, isSignedIn: () => true })
    await guard.onAuthChange()
    expect(s.getItem(IDLE_KEY)).toBe('999')
  })
})

describe('createIdleGuard — cross-tab', () => {
  it('another tab cleared the idle key while signed in → mirrors the sign-out', async () => {
    const { guard, signOut } = setup()
    await guard.onIdleKeyClearedElsewhere()
    expect(signOut).toHaveBeenCalledTimes(1)
  })
  it('not eligible → ignores a cross-tab key clear', async () => {
    const { guard, signOut } = setup({ isEligible: () => false })
    await guard.onIdleKeyClearedElsewhere()
    expect(signOut).not.toHaveBeenCalled()
  })
})
