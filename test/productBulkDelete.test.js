import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { createFakeSupabase } from './helpers/fakeSupabase.js'

/**
 * Endpoint-level coverage for POST /api/admin/products/bulk-delete. Proves:
 * the Test Product is never deletable, a product referenced by a
 * stockist's inventory is skipped (not deleted, not failing the batch),
 * and everything else deletes with Storage image cleanup — mirroring the
 * single-product endpoint's exact exclusions, applied per id.
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

const ID_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' // test-product
const ID_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' // referenced by a stockist
const ID_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc' // free to delete

beforeAll(async () => {
  stubGlobals()
  const mod = await import('../server/api/admin/products/bulk-delete.post.js')
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
  return (await import('../server/api/admin/products/bulk-delete.post.js')).default
}

describe('POST /api/admin/products/bulk-delete', () => {
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
    await handler(ev)
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
    const ev = event({ ids: [ID_A, 'bad'] })
    await handler(ev)
    expect(ev._status).toBe(400)
  })

  it('never deletes the Test Product, skips a stockist-referenced product, deletes the rest with image cleanup', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const rows = [
      { id: ID_A, slug: 'test-product', product_images: [] },
      { id: ID_B, slug: 'classic-top', product_images: [] },
      {
        id: ID_C,
        slug: 'free-top',
        product_images: [{ image_url: 'https://proj.supabase.co/storage/v1/object/public/product-images/pic.jpg' }]
      }
    ]
    const supabase = createFakeSupabase([
      { data: rows, error: null }, // product lookup
      { data: [{ product_id: ID_B }], error: null }, // stockist reference check
      { data: [{ id: ID_C }], error: null } // delete
    ])
    const storageRemove = vi.fn().mockResolvedValue({ error: null })
    supabase.storage = { from: () => ({ remove: storageRemove }) }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A, ID_B, ID_C] }))

    expect(res.ok).toBe(true)
    expect(res.deletedCount).toBe(1)
    expect(res.requestedCount).toBe(3)
    expect(res.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ID_A, reason: expect.stringContaining('Test Product') }),
        expect.objectContaining({ id: ID_B, reason: expect.stringContaining('stockist') })
      ])
    )
    const deleteCall = supabase._calls.find((c) => c.table === 'products' && c.op === 'delete')
    expect(deleteCall.filters).toEqual([['in', 'id', [ID_C]]])
    expect(storageRemove).toHaveBeenCalledWith(['pic.jpg'])
  })

  it('an unknown id is skipped and reported as not found', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([
      { data: [], error: null },
      { data: [], error: null }
    ])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_C] }))
    expect(res.skipped).toEqual([{ id: ID_C, reason: 'not found' }])
    expect(res.deletedCount).toBe(0)
  })

  it('stockist-reference check failure fails CLOSED — nothing deleted', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([
      { data: [{ id: ID_C, slug: 'free-top', product_images: [] }], error: null },
      { data: null, error: { message: 'db down' } }
    ])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const ev = event({ ids: [ID_C] })
    const res = await handler(ev)
    expect(ev._status).toBe(500)
    expect(supabase._calls.some((c) => c.op === 'delete')).toBe(false)
  })
})
