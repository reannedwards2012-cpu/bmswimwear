import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { createFakeSupabase } from './helpers/fakeSupabase.js'

/**
 * Endpoint-level coverage for POST /api/admin/fabrics/bulk-delete. Proves
 * the reference-safety contract explicitly required for this round: a
 * fabric used by a product OR referenced by a live Swimsuit Mixer booking
 * is SKIPPED (never deleted, never fails the whole batch); everything else
 * deletes cleanly with its product_fabrics links and Storage image cleaned
 * up. Also proves reference-check failures fail CLOSED (block, don't guess).
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

const ID_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' // in use by a product
const ID_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' // referenced by a booking
const ID_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc' // free to delete

beforeAll(async () => {
  stubGlobals()
  const mod = await import('../server/api/admin/fabrics/bulk-delete.post.js')
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
  return (await import('../server/api/admin/fabrics/bulk-delete.post.js')).default
}

describe('POST /api/admin/fabrics/bulk-delete', () => {
  it('non-admin cannot bulk-delete — zero Supabase calls', async () => {
    requireAdmin.mockRejectedValue(Object.assign(new Error('Admin access required'), { statusCode: 403 }))
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler()

    await expect(handler(event({ ids: [ID_A] }))).rejects.toThrow('Admin access required')
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('empty ids -> 400', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const ev = event({ ids: [] })
    const res = await handler(ev)
    expect(ev._status).toBe(400)
  })

  it(`more than ${MAX_BULK_IDS} ids -> 400`, async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const tooMany = Array.from({ length: MAX_BULK_IDS + 1 }, (_, i) => `aaaaaaaa-aaaa-aaaa-aaaa-${String(i).padStart(12, '0')}`)
    const res = await handler(event({ ids: tooMany }))
    expect(res.error).toBeTruthy()
  })

  it('malformed id rejects the whole batch', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const ev = event({ ids: [ID_A, 'not-a-uuid'] })
    const res = await handler(ev)
    expect(ev._status).toBe(400)
  })

  it('skips a fabric in use by a product, skips one referenced by a booking, deletes the rest', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([
      { data: [{ fabric_id: ID_A }], error: null }, // product_fabrics check
      { data: [{ left_fabric_id: ID_B, right_fabric_id: null, bottom_fabric_id: null, onepiece_fabric_id: null }], error: null }, // bookings check
      { data: null, error: null }, // product_fabrics cleanup delete (for ID_C only)
      { data: [{ id: ID_C, image_url: null }], error: null } // fabrics delete
    ])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A, ID_B, ID_C] }))

    expect(res.ok).toBe(true)
    expect(res.deletedCount).toBe(1)
    expect(res.requestedCount).toBe(3)
    expect(res.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ID_A, reason: expect.stringContaining('in use by') }),
        expect.objectContaining({ id: ID_B, reason: expect.stringContaining('Swimsuit Mixer booking') })
      ])
    )

    const deleteCall = supabase._calls.find((c) => c.table === 'fabrics' && c.op === 'delete')
    expect(deleteCall.filters).toEqual([['in', 'id', [ID_C]]])
  })

  it('a fabric used by 2 products reports the count', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([
      { data: [{ fabric_id: ID_A }, { fabric_id: ID_A }], error: null },
      { data: [], error: null }
    ])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A] }))
    expect(res.skipped).toEqual([{ id: ID_A, reason: 'in use by 2 products' }])
    expect(res.deletedCount).toBe(0)
    // nothing eligible -> no delete calls at all
    expect(supabase._calls.some((c) => c.op === 'delete')).toBe(false)
  })

  it('a missing bikini_mix_bookings table (migration not applied) is treated as "nothing references it" — still deletes', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([
      { data: [], error: null },
      { data: null, error: { code: '42P01', message: 'relation "bikini_mix_bookings" does not exist' } },
      { data: null, error: null },
      { data: [{ id: ID_C, image_url: null }], error: null }
    ])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_C] }))
    expect(res.deletedCount).toBe(1)
    expect(res.skipped).toEqual([])
  })

  it('a genuine infra error on the product_fabrics check fails CLOSED — nothing deleted', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([{ data: null, error: { message: 'db down' } }])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const ev = event({ ids: [ID_C] })
    const res = await handler(ev)
    expect(ev._status).toBe(500)
    expect(res.error).toBeTruthy()
    expect(supabase._calls.some((c) => c.op === 'delete')).toBe(false)
  })

  it('a genuine infra error on the bookings check (not a missing-table code) fails CLOSED', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([
      { data: [], error: null },
      { data: null, error: { code: '53300', message: 'too many connections' } }
    ])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const ev = event({ ids: [ID_C] })
    const res = await handler(ev)
    expect(ev._status).toBe(500)
    expect(supabase._calls.some((c) => c.op === 'delete')).toBe(false)
  })

  it('best-effort Storage cleanup runs for deleted fabrics that had an image', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([
      { data: [], error: null },
      { data: [], error: null },
      { data: null, error: null },
      { data: [{ id: ID_C, image_url: 'https://proj.supabase.co/storage/v1/object/public/fabric-images/pic.jpg' }], error: null }
    ])
    const storageRemove = vi.fn().mockResolvedValue({ error: null })
    supabase.storage = { from: () => ({ remove: storageRemove }) }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_C] }))
    expect(res.deletedCount).toBe(1)
    expect(storageRemove).toHaveBeenCalledWith(['pic.jpg'])
  })
})
