import { describe, it, expect, vi } from 'vitest'
import {
  IDLE_KEY,
  ADMIN_IDLE_KEY,
  IDLE_TIMEOUT_MS,
  ADMIN_IDLE_TIMEOUT_MS,
  ADMIN_IDLE_WARNING_MS,
  readLastActive,
  writeLastActive,
  clearLastActive,
  createIdleGuard,
  msUntilIdleExpiry
} from '../utils/idleSession.js'

/**
 * Phase 1 security hardening — the admin-specific half of the idle-logout
 * guard. test/idleSession.test.js already exhaustively covers
 * createIdleGuard's behaviour using the DEFAULT key (customer, 24h); these
 * tests prove the two guards (customer 24h, admin 30min) are fully
 * independent when sharing the same underlying localStorage object — the
 * actual real-world setup in plugins/idle-logout.client.js.
 */

function fakeStorage(initial = {}) {
  const m = new Map(Object.entries(initial))
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k)
  }
}

const MINUTE = 60 * 1000

describe('admin idle constants', () => {
  it('30 minutes, distinct from the 24h customer window and a distinct storage key', () => {
    expect(ADMIN_IDLE_TIMEOUT_MS).toBe(30 * MINUTE)
    expect(ADMIN_IDLE_TIMEOUT_MS).toBeLessThan(IDLE_TIMEOUT_MS)
    expect(ADMIN_IDLE_KEY).not.toBe(IDLE_KEY)
  })
})

describe('readLastActive / writeLastActive / clearLastActive — keyed', () => {
  it('writing under ADMIN_IDLE_KEY never touches the customer IDLE_KEY slot, and vice versa', () => {
    const s = fakeStorage()
    writeLastActive(s, 111, ADMIN_IDLE_KEY)
    writeLastActive(s, 222, IDLE_KEY)
    expect(readLastActive(s, ADMIN_IDLE_KEY)).toBe(111)
    expect(readLastActive(s, IDLE_KEY)).toBe(222)

    clearLastActive(s, ADMIN_IDLE_KEY)
    expect(readLastActive(s, ADMIN_IDLE_KEY)).toBeNull()
    expect(readLastActive(s, IDLE_KEY)).toBe(222) // untouched
  })

  it('default key (no 3rd arg) is still IDLE_KEY — existing customer call sites unaffected', () => {
    const s = fakeStorage()
    writeLastActive(s, 999)
    expect(readLastActive(s, IDLE_KEY)).toBe(999)
    expect(readLastActive(s)).toBe(999)
  })
})

describe('two independent createIdleGuard instances sharing one storage object', () => {
  function setupBoth(clock) {
    const storage = fakeStorage()
    const customerSignOut = vi.fn(async () => ({ error: null }))
    const adminSignOut = vi.fn(async () => ({ error: null }))
    const customerRedirect = vi.fn()
    const adminRedirect = vi.fn()

    let customerEligible = true
    let adminEligible = false // mutually exclusive with customer in real usage

    const customerGuard = createIdleGuard({
      storage,
      now: () => clock.t,
      key: IDLE_KEY,
      timeoutMs: IDLE_TIMEOUT_MS,
      isEligible: () => customerEligible,
      isSignedIn: () => true,
      signOut: customerSignOut,
      isOnProtectedRoute: () => true,
      redirectToLogin: customerRedirect
    })

    const adminGuard = createIdleGuard({
      storage,
      now: () => clock.t,
      key: ADMIN_IDLE_KEY,
      timeoutMs: ADMIN_IDLE_TIMEOUT_MS,
      isEligible: () => adminEligible,
      isSignedIn: () => true,
      signOut: adminSignOut,
      isOnProtectedRoute: () => true,
      redirectToLogin: adminRedirect
    })

    return {
      storage,
      customerGuard,
      adminGuard,
      customerSignOut,
      adminSignOut,
      customerRedirect,
      adminRedirect,
      setCustomerEligible: (v) => (customerEligible = v),
      setAdminEligible: (v) => (adminEligible = v)
    }
  }

  it('admin activity never extends the customer idle window, and vice versa', async () => {
    const clock = { t: 10_000_000_000 }
    const { customerGuard, adminGuard, storage, setAdminEligible } = setupBoth(clock)
    setAdminEligible(true)

    await customerGuard.checkIdle() // seeds customer key
    await adminGuard.checkIdle() // seeds admin key
    const customerSeed = readLastActive(storage, IDLE_KEY)
    const adminSeed = readLastActive(storage, ADMIN_IDLE_KEY)

    clock.t += 5 * MINUTE
    adminGuard.recordActivity() // only admin is "eligible" here
    expect(readLastActive(storage, ADMIN_IDLE_KEY)).toBe(clock.t)
    expect(readLastActive(storage, IDLE_KEY)).toBe(customerSeed) // untouched
    expect(adminSeed).not.toBe(readLastActive(storage, ADMIN_IDLE_KEY))
  })

  it('admin session expires after 30 minutes idle while a (hypothetically concurrent) customer session at the same age would not', async () => {
    const clock = { t: 10_000_000_000 }
    const { customerGuard, adminGuard, storage, adminSignOut, customerSignOut, setAdminEligible } = setupBoth(clock)
    setAdminEligible(true)

    writeLastActive(storage, clock.t, ADMIN_IDLE_KEY)
    writeLastActive(storage, clock.t, IDLE_KEY)

    clock.t += 31 * MINUTE // past admin's 30min, nowhere near customer's 24h

    expect(await adminGuard.checkIdle()).toBe('expired')
    expect(adminSignOut).toHaveBeenCalledTimes(1)

    // The customer guard is a separate instance with its own key/timeout —
    // at the same elapsed time it is nowhere near 24h, so an equivalent
    // check on it would report 'active', not 'expired'.
    expect(customerSignOut).not.toHaveBeenCalled()
  })
})

describe('msUntilIdleExpiry — the "continue session?" warning\'s pure threshold check', () => {
  it('null when there is no timestamp yet (not seeded) — never warns on a fresh/cleared session', () => {
    expect(msUntilIdleExpiry(null, Date.now(), ADMIN_IDLE_TIMEOUT_MS)).toBeNull()
  })

  it('counts down linearly as time passes', () => {
    const last = 10_000_000_000
    expect(msUntilIdleExpiry(last, last, ADMIN_IDLE_TIMEOUT_MS)).toBe(ADMIN_IDLE_TIMEOUT_MS)
    expect(msUntilIdleExpiry(last, last + 10 * MINUTE, ADMIN_IDLE_TIMEOUT_MS)).toBe(20 * MINUTE)
  })

  it('goes negative past the timeout — callers treat <= 0 as already-expired, never clamp to 0 here', () => {
    const last = 10_000_000_000
    const remaining = msUntilIdleExpiry(last, last + 31 * MINUTE, ADMIN_IDLE_TIMEOUT_MS)
    expect(remaining).toBeLessThan(0)
  })

  it('crosses the warning threshold at exactly 28 minutes idle (30min timeout - 2min warning)', () => {
    const last = 10_000_000_000
    const atWarningEdge = msUntilIdleExpiry(last, last + 28 * MINUTE, ADMIN_IDLE_TIMEOUT_MS)
    expect(atWarningEdge).toBe(ADMIN_IDLE_WARNING_MS)
    expect(atWarningEdge <= ADMIN_IDLE_WARNING_MS).toBe(true) // the plugin's poll would now show the modal

    const justBefore = msUntilIdleExpiry(last, last + 28 * MINUTE - 1000, ADMIN_IDLE_TIMEOUT_MS)
    expect(justBefore > ADMIN_IDLE_WARNING_MS).toBe(true) // still hidden one second earlier
  })
})
