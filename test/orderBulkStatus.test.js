import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { createFakeSupabase } from './helpers/fakeSupabase.js'

/**
 * Endpoint-level coverage for POST /api/admin/orders/bulk-status. Proves:
 * admin gating, 'paid' is ALWAYS rejected (the one hard rule beyond the
 * single-order endpoint), per-row transition validation against
 * orderStatus.js (a batch with mixed sources/current-statuses only updates
 * what's actually valid for each row), and that a partial success is
 * reported, not silently swallowed or allowed to fail the whole batch.
 */

vi.mock('../server/utils/authUser.js', () => ({ requireAdmin: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))

import { requireAdmin } from '../server/utils/authUser.js'
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'

let MAX_BULK_IDS

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('readBody', async (e) => e._body)
  vi.stubGlobal('setResponseStatus', (e, s) => {
    e._status = s
  })
}
const event = (body) => ({ _body: body, _status: 200 })

const ID_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const ID_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const ID_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

beforeAll(async () => {
  stubGlobals()
  const mod = await import('../server/api/admin/orders/bulk-status.post.js')
  MAX_BULK_IDS = mod.MAX_BULK_IDS
})
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function loadHandler() {
  stubGlobals()
  return (await import('../server/api/admin/orders/bulk-status.post.js')).default
}

describe('POST /api/admin/orders/bulk-status', () => {
  it('non-admin cannot bulk-update — zero Supabase calls', async () => {
    requireAdmin.mockRejectedValue(Object.assign(new Error('Admin access required'), { statusCode: 403 }))
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler()

    await expect(handler(event({ ids: [ID_A], status: 'processing' }))).rejects.toThrow('Admin access required')
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('target status "paid" is ALWAYS rejected, regardless of source — zero Supabase calls', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler()

    const ev = event({ ids: [ID_A], status: 'paid' })
    const res = await handler(ev)
    expect(ev._status).toBe(400)
    expect(res.error).toMatch(/bulk/i)
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('invalid status value -> 400', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const ev = event({ ids: [ID_A], status: 'not-a-real-status' })
    const res = await handler(ev)
    expect(ev._status).toBe(400)
  })

  it('empty ids -> 400', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const ev = event({ ids: [], status: 'processing' })
    expect((await handler(ev))._status ?? ev._status).toBe(400)
  })

  it(`more than ${MAX_BULK_IDS} ids -> 400`, async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const tooMany = Array.from({ length: MAX_BULK_IDS + 1 }, (_, i) => `aaaaaaaa-aaaa-aaaa-aaaa-${String(i).padStart(12, '0')}`)
    const ev = event({ ids: tooMany, status: 'processing' })
    const res = await handler(ev)
    expect(ev._status).toBe(400)
  })

  it('malformed id rejects the whole batch', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const ev = event({ ids: [ID_A, 'not-a-uuid'], status: 'processing' })
    const res = await handler(ev)
    expect(ev._status).toBe(400)
  })

  it('moves eligible "paid" website orders to "processing", skips a "completed" one (invalid transition — terminal)', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const rows = [
      { id: ID_A, source: 'website', status: 'paid' }, // paid -> processing: allowed
      { id: ID_B, source: 'website', status: 'completed' } // completed is terminal: NOT allowed
    ]
    const supabase = createFakeSupabase([
      { data: rows, error: null }, // lookup
      { data: [{ id: ID_A }], error: null } // per-row update for ID_A
    ])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A, ID_B], status: 'processing' }))

    expect(res.ok).toBe(true)
    expect(res.updatedCount).toBe(1)
    expect(res.requestedCount).toBe(2)
    expect(res.skipped).toEqual([{ id: ID_B, reason: expect.stringContaining("can't move") }])

    const updateCall = supabase._calls.find((c) => c.op === 'update')
    expect(updateCall.payload.status).toBe('processing')
    expect(updateCall.filters).toEqual(expect.arrayContaining([['eq', 'id', ID_A], ['eq', 'status', 'paid']]))
  })

  it('manual pending -> paid is allowed per-row rules, but "paid" is globally blocked at the body-validation stage before any row is even read', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler()
    const res = await handler(event({ ids: [ID_A], status: 'paid' }))
    expect(res.error).toBeTruthy()
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('a concurrent change (status moved since lookup) is skipped and reported, not silently clobbered', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const rows = [{ id: ID_A, source: 'website', status: 'paid' }]
    const supabase = createFakeSupabase([
      { data: rows, error: null },
      { data: [], error: null } // update matched zero rows -> concurrent change
    ])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A], status: 'processing' }))
    expect(res.updatedCount).toBe(0)
    expect(res.skipped).toEqual([{ id: ID_A, reason: expect.stringContaining('changed since') }])
  })

  it('an unknown id is skipped and reported as not found', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([{ data: [], error: null }])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A], status: 'processing' }))
    expect(res.skipped).toEqual([{ id: ID_A, reason: 'not found' }])
  })

  it('an abandoned website checkout (pending, hidden) is skipped, not treated as a visible order', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const rows = [{ id: ID_A, source: 'website', status: 'pending' }]
    const supabase = createFakeSupabase([{ data: rows, error: null }])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A], status: 'cancelled' }))
    expect(res.skipped).toEqual([{ id: ID_A, reason: expect.stringContaining('abandoned') }])
    expect(supabase._calls.some((c) => c.op === 'update')).toBe(false)
  })

  it('a batch of three with mixed outcomes reports success/skip per row independently', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const rows = [
      { id: ID_A, source: 'website', status: 'paid' }, // ok
      { id: ID_B, source: 'instagram', status: 'completed' }, // terminal, no transitions
      { id: ID_C, source: 'website', status: 'paid' } // ok
    ]
    const supabase = createFakeSupabase([
      { data: rows, error: null },
      { data: [{ id: ID_A }], error: null },
      { data: [{ id: ID_C }], error: null }
    ])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A, ID_B, ID_C], status: 'processing' }))
    expect(res.updatedCount).toBe(2)
    expect(res.requestedCount).toBe(3)
    expect(res.skipped).toEqual([{ id: ID_B, reason: expect.stringContaining("can't move") }])
  })

  it('lookup failure -> 500', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([{ data: null, error: { message: 'db down' } }])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const ev = event({ ids: [ID_A], status: 'processing' })
    const res = await handler(ev)
    expect(ev._status).toBe(500)
    expect(res.error).toBeTruthy()
  })
})
