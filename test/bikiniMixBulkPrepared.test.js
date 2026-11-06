import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { createFakeSupabase } from './helpers/fakeSupabase.js'

/**
 * Endpoint-level coverage for POST /api/admin/bikini-mix/bookings/bulk-prepared.
 * Proves the one hard rule explicitly required for this round: only a
 * 'confirmed' booking can be marked prepared — anything else (pending,
 * needs-review, cancelled, expired) is skipped and reported, never
 * silently dropped. Payment/status/guest fields are never touched.
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
const ID_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' // confirmed
const ID_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' // pending_payment

beforeAll(async () => {
  stubGlobals()
  const mod = await import('../server/api/admin/bikini-mix/bookings/bulk-prepared.post.js')
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
  return (await import('../server/api/admin/bikini-mix/bookings/bulk-prepared.post.js')).default
}

describe('POST /api/admin/bikini-mix/bookings/bulk-prepared', () => {
  it('non-admin cannot bulk-update — zero Supabase calls', async () => {
    requireAdmin.mockRejectedValue(Object.assign(new Error('Admin access required'), { statusCode: 403 }))
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler()
    await expect(handler(event({ ids: [ID_A], prepared: true }))).rejects.toThrow('Admin access required')
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('missing "prepared" boolean -> 400', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const ev = event({ ids: [ID_A] })
    await handler(ev)
    expect(ev._status).toBe(400)
  })

  it('empty ids -> 400', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const ev = event({ ids: [], prepared: true })
    await handler(ev)
    expect(ev._status).toBe(400)
  })

  it(`more than ${MAX_BULK_IDS} ids -> 400`, async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const tooMany = Array.from({ length: MAX_BULK_IDS + 1 }, (_, i) => `aaaaaaaa-aaaa-aaaa-aaaa-${String(i).padStart(12, '0')}`)
    const res = await handler(event({ ids: tooMany, prepared: true }))
    expect(res.error).toBeTruthy()
  })

  it('malformed id rejects the whole batch', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const ev = event({ ids: [ID_A, 'bad'], prepared: true })
    await handler(ev)
    expect(ev._status).toBe(400)
  })

  it('marks confirmed bookings prepared, skips a pending_payment one, reports why', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([
      { data: [{ id: ID_A, status: 'confirmed' }, { id: ID_B, status: 'pending_payment' }], error: null }, // lookup
      { data: [{ id: ID_A }], error: null } // update
    ])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A, ID_B], prepared: true }))
    expect(res.ok).toBe(true)
    expect(res.updatedCount).toBe(1)
    expect(res.requestedCount).toBe(2)
    expect(res.skipped).toEqual([{ id: ID_B, reason: expect.stringContaining('confirmed') }])

    const updateCall = supabase._calls.find((c) => c.op === 'update')
    expect(updateCall.filters).toEqual(expect.arrayContaining([['in', 'id', [ID_A]], ['eq', 'status', 'confirmed']]))
    expect(updateCall.payload.base_prepared_at).toBeTruthy()
  })

  it('unmark prepared (prepared: false) sets base_prepared_at to null', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([
      { data: [{ id: ID_A, status: 'confirmed' }], error: null },
      { data: [{ id: ID_A }], error: null }
    ])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A], prepared: false }))
    expect(res.updatedCount).toBe(1)
    const updateCall = supabase._calls.find((c) => c.op === 'update')
    expect(updateCall.payload.base_prepared_at).toBeNull()
  })

  it('an unknown id is skipped and reported as not found, with no update call', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([{ data: [], error: null }])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A], prepared: true }))
    expect(res.skipped).toEqual([{ id: ID_A, reason: 'not found' }])
    expect(supabase._calls.some((c) => c.op === 'update')).toBe(false)
  })

  it('lookup failure -> 500', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([{ data: null, error: { message: 'db down' } }])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const ev = event({ ids: [ID_A], prepared: true })
    const res = await handler(ev)
    expect(ev._status).toBe(500)
    expect(res.error).toBeTruthy()
  })
})
