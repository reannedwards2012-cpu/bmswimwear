import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { createFakeSupabase } from './helpers/fakeSupabase.js'

/**
 * Endpoint-level coverage for POST /api/admin/orders/bulk-archive. Proves:
 * admin gating, validation (missing/invalid body, cap), and per-row
 * eligibility (manual orders / abandoned checkouts / already-in-the-
 * target-state rows are skipped and reported, never silently dropped or
 * allowed to fail the whole batch) — mirroring the single-order archive
 * endpoint's exact rules, just applied per id.
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

function order(id, over = {}) {
  return { id, order_number: 1, source: 'website', status: 'paid', archived_at: null, ...over }
}

beforeAll(async () => {
  stubGlobals()
  const mod = await import('../server/api/admin/orders/bulk-archive.post.js')
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
  return (await import('../server/api/admin/orders/bulk-archive.post.js')).default
}

describe('POST /api/admin/orders/bulk-archive', () => {
  it('non-admin cannot bulk-archive — zero Supabase calls', async () => {
    requireAdmin.mockRejectedValue(Object.assign(new Error('Admin access required'), { statusCode: 403 }))
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler()

    await expect(handler(event({ ids: [ID_A], archived: true }))).rejects.toThrow('Admin access required')
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('missing "archived" boolean -> 400', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const ev = event({ ids: [ID_A] })
    const res = await handler(ev)
    expect(ev._status).toBe(400)
    expect(res.error).toBeTruthy()
  })

  it('empty ids -> 400', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const ev = event({ ids: [], archived: true })
    const res = await handler(ev)
    expect(ev._status).toBe(400)
  })

  it(`more than ${MAX_BULK_IDS} ids -> 400`, async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const tooMany = Array.from({ length: MAX_BULK_IDS + 1 }, (_, i) => `aaaaaaaa-aaaa-aaaa-aaaa-${String(i).padStart(12, '0')}`)
    const ev = event({ ids: tooMany, archived: true })
    const res = await handler(ev)
    expect(ev._status).toBe(400)
  })

  it('malformed id rejects the whole batch', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const ev = event({ ids: [ID_A, 'not-a-uuid'], archived: true })
    const res = await handler(ev)
    expect(ev._status).toBe(400)
  })

  it('archives eligible website orders, skips a manual order and an already-archived one, reports why', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const rows = [
      order(ID_A, { source: 'website', status: 'paid', archived_at: null }), // eligible
      order(ID_B, { source: 'instagram', status: 'paid' }), // manual — skip
      order(ID_C, { source: 'website', status: 'paid', archived_at: '2026-01-01T00:00:00Z' }) // already archived — skip
    ]
    const supabase = createFakeSupabase([
      { data: rows, error: null }, // lookup
      { data: [{ id: ID_A }], error: null } // update
    ])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A, ID_B, ID_C], archived: true }))

    expect(res.ok).toBe(true)
    expect(res.updatedCount).toBe(1)
    expect(res.requestedCount).toBe(3)
    expect(res.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ID_B, reason: expect.stringContaining('manual') }),
        expect.objectContaining({ id: ID_C, reason: expect.stringContaining('already archived') })
      ])
    )
    const updateCall = supabase._calls.find((c) => c.op === 'update')
    expect(updateCall.filters).toEqual([['in', 'id', [ID_A]]])
    expect(updateCall.payload.archived_at).toBeTruthy()
  })

  it('an unknown id is skipped and reported as not found', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([{ data: [], error: null }])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A], archived: true }))
    expect(res.updatedCount).toBe(0)
    expect(res.skipped).toEqual([{ id: ID_A, reason: 'not found' }])
    // nothing eligible -> no update call at all
    expect(supabase._calls.some((c) => c.op === 'update')).toBe(false)
  })

  it('restore (archived:false) only applies to currently-archived website orders', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const rows = [order(ID_A, { source: 'website', status: 'paid', archived_at: '2026-01-01T00:00:00Z' })]
    const supabase = createFakeSupabase([
      { data: rows, error: null },
      { data: [{ id: ID_A }], error: null }
    ])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A], archived: false }))
    expect(res.updatedCount).toBe(1)
    const updateCall = supabase._calls.find((c) => c.op === 'update')
    expect(updateCall.payload.archived_at).toBeNull()
  })

  it('lookup failure -> 500', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([{ data: null, error: { message: 'db down' } }])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const ev = event({ ids: [ID_A], archived: true })
    const res = await handler(ev)
    expect(ev._status).toBe(500)
    expect(res.error).toBeTruthy()
  })
})
