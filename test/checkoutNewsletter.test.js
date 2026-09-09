import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFakeSupabase, hasFilter } from './helpers/fakeSupabase.js'
import { subscribeAtCheckout, maybeSyncPaidOrderMarketing } from '../server/utils/checkoutNewsletter.js'

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => vi.restoreAllMocks())

describe('subscribeAtCheckout — optional marketing opt-in from checkout', () => {
  it('does nothing when not opted in (unchecked box)', async () => {
    const subscribe = vi.fn()
    const r = await subscribeAtCheckout({ email: 'her@example.com', optIn: false }, { subscribe })
    expect(r).toEqual({ ok: false, skipped: true })
    expect(subscribe).not.toHaveBeenCalled()
  })

  it('does nothing without an email', async () => {
    const subscribe = vi.fn()
    await subscribeAtCheckout({ email: '', optIn: true }, { subscribe })
    expect(subscribe).not.toHaveBeenCalled()
  })

  it('opted in → subscribes the email (List #3 via the existing newsletter path)', async () => {
    const subscribe = vi.fn(async () => ({ ok: true, status: 'subscribed' }))
    const r = await subscribeAtCheckout({ email: 'HER@Example.com', optIn: true }, { subscribe })
    expect(subscribe).toHaveBeenCalledWith({ email: 'HER@Example.com' })
    expect(r.ok).toBe(true)
  })

  it('a Brevo failure does not throw (checkout must not fail)', async () => {
    const subscribe = vi.fn(async () => ({ ok: false, status: 'failed' }))
    await expect(
      subscribeAtCheckout({ email: 'her@example.com', optIn: true }, { subscribe })
    ).resolves.toEqual(expect.objectContaining({ ok: false }))
  })

  it('a thrown error is swallowed', async () => {
    const subscribe = vi.fn(async () => {
      throw new Error('brevo down')
    })
    await expect(
      subscribeAtCheckout({ email: 'her@example.com', optIn: true }, { subscribe })
    ).resolves.toEqual(expect.objectContaining({ ok: false }))
  })
})

describe('maybeSyncPaidOrderMarketing — subscribe only after a verified paid order', () => {
  const ok = vi.fn(async () => ({ ok: true, status: 'subscribed' }))

  it('paid + opted-in + not yet synced → claims and subscribes; guard is paid/website/opt-in/unsynced', async () => {
    const subscribe = vi.fn(ok)
    const sb = createFakeSupabase([{ data: [{ email: 'her@example.com' }], error: null }])

    await maybeSyncPaidOrderMarketing(sb, 'o1', { subscribe })

    expect(subscribe).toHaveBeenCalledWith({ email: 'her@example.com' })
    const claim = sb._calls[0]
    expect(claim.op).toBe('update')
    expect(typeof claim.payload.marketing_synced_at).toBe('string') // lease value
    expect(hasFilter(claim, 'eq', 'status', 'paid')).toBe(true)
    expect(hasFilter(claim, 'eq', 'source', 'website')).toBe(true)
    expect(hasFilter(claim, 'eq', 'marketing_opt_in', true)).toBe(true)
    expect(hasFilter(claim, 'is', 'marketing_synced_at', null)).toBe(true)
    expect(sb._calls).toHaveLength(1) // no release on success
  })

  it('pending / abandoned / cancelled order → claim matches nothing → not subscribed', async () => {
    const subscribe = vi.fn(ok)
    // DB returns no rows because status != 'paid'
    const sb = createFakeSupabase([{ data: [], error: null }])
    await maybeSyncPaidOrderMarketing(sb, 'pending-1', { subscribe })
    expect(subscribe).not.toHaveBeenCalled()
  })

  it('paid order that did NOT opt in → claim matches nothing → not subscribed', async () => {
    const subscribe = vi.fn(ok)
    const sb = createFakeSupabase([{ data: [], error: null }]) // marketing_opt_in = false filtered out
    await maybeSyncPaidOrderMarketing(sb, 'o2', { subscribe })
    expect(subscribe).not.toHaveBeenCalled()
  })

  it('repeated Go2Pay callback (already synced) → claim matches nothing → no duplicate subscribe', async () => {
    const subscribe = vi.fn(ok)
    const sb = createFakeSupabase([{ data: [], error: null }]) // marketing_synced_at already set
    await maybeSyncPaidOrderMarketing(sb, 'o1', { subscribe })
    expect(subscribe).not.toHaveBeenCalled()
    expect(sb._calls).toHaveLength(1)
  })

  it('Brevo failure → marker released (ownership-guarded) so a later callback retries; never throws', async () => {
    const subscribe = vi.fn(async () => ({ ok: false, status: 'failed' }))
    const sb = createFakeSupabase([
      { data: [{ email: 'her@example.com' }], error: null }, // claim
      { data: [{ id: 'o1' }], error: null } // release
    ])

    await expect(maybeSyncPaidOrderMarketing(sb, 'o1', { subscribe })).resolves.toBeUndefined()

    const leaseValue = sb._calls[0].payload.marketing_synced_at
    const release = sb._calls[1]
    expect(release.op).toBe('update')
    expect(release.payload).toEqual({ marketing_synced_at: null })
    expect(hasFilter(release, 'eq', 'marketing_synced_at', leaseValue)).toBe(true)
  })

  it('a thrown Brevo error is swallowed and the marker is released', async () => {
    const subscribe = vi.fn(async () => {
      throw new Error('network')
    })
    const sb = createFakeSupabase([
      { data: [{ email: 'her@example.com' }], error: null },
      { data: [{ id: 'o1' }], error: null }
    ])
    await expect(maybeSyncPaidOrderMarketing(sb, 'o1', { subscribe })).resolves.toBeUndefined()
    expect(sb._calls[1].payload).toEqual({ marketing_synced_at: null })
  })

  it('a claim DB error is logged and swallowed — no subscribe, no throw', async () => {
    const subscribe = vi.fn(ok)
    const sb = createFakeSupabase([{ data: null, error: { message: 'boom' } }])
    await expect(maybeSyncPaidOrderMarketing(sb, 'o1', { subscribe })).resolves.toBeUndefined()
    expect(subscribe).not.toHaveBeenCalled()
  })
})
