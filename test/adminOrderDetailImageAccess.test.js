import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Phase 2 security hardening — GET /api/admin/orders/:id now resolves each
 * custom item's 'order-images' reference into a short-lived signed URL
 * instead of returning the (old, public-bucket-shaped) stored value as-is.
 *
 * The core access-control property under test: the path handed to
 * createSignedUrl() always comes from THIS order's own already-fetched row
 * — never from anything the client supplies — so there is no way to make
 * the server mint a signed URL for a different order/customer's image by
 * guessing or modifying the :id route param or any request input.
 */

vi.mock('../server/utils/authUser.js', () => ({ requireAdmin: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))

import { requireAdmin } from '../server/utils/authUser.js'
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'
import { ORDER_IMAGE_BUCKET } from '../server/utils/orderImages.js'

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('setResponseStatus', (e, s) => { e._status = s })
  vi.stubGlobal('getRouterParam', (e, k) => e._params?.[k])
}
const event = (params) => ({ _params: params, _status: 200 })

const ORDER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const STORED_IMAGE = `https://proj.supabase.co/storage/v1/object/public/${ORDER_IMAGE_BUCKET}/the-real-path.jpg`

function fakeSupabase(row) {
  const signCalls = []
  return {
    _signCalls: signCalls,
    from(table) {
      expect(table).toBe('orders')
      return {
        select: () => ({
          eq: (col, val) => ({
            maybeSingle: () => {
              if (col === 'id' && val !== ORDER_ID) return Promise.resolve({ data: null, error: null })
              return Promise.resolve({ data: row, error: null })
            }
          })
        })
      }
    },
    storage: {
      from(bucket) {
        return {
          createSignedUrl(path, expiresIn) {
            signCalls.push({ bucket, path, expiresIn })
            return Promise.resolve({ data: { signedUrl: `https://signed.example/${path}` }, error: null })
          }
        }
      }
    }
  }
}

let handler

beforeEach(async () => {
  stubGlobals()
  requireAdmin.mockReset().mockResolvedValue({ id: 'admin-1' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  handler = (await import('../server/api/admin/orders/[id].get.js')).default
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GET /api/admin/orders/:id — unauthorized access', () => {
  it('requireAdmin rejecting (not signed in / not an admin) means Storage is never touched', async () => {
    requireAdmin.mockRejectedValueOnce(Object.assign(new Error('Admin access required'), { statusCode: 403 }))
    const supabase = fakeSupabase({ id: ORDER_ID, order_items: [{ image: STORED_IMAGE, is_custom: true }] })
    supabaseAdmin.mockReturnValue(supabase)

    await expect(handler(event({ id: ORDER_ID }))).rejects.toMatchObject({ statusCode: 403 })
    expect(supabase._signCalls).toEqual([])
  })
})

describe('GET /api/admin/orders/:id — image signing', () => {
  it("replaces a custom item's stored image URL with a freshly-signed one, derived from this order's own row", async () => {
    const row = {
      id: ORDER_ID, order_number: 1, source: 'instagram', status: 'paid', currency: 'USD',
      order_items: [{ product_name: 'Custom bikini', image: STORED_IMAGE, is_custom: true, quantity: 1 }]
    }
    const supabase = fakeSupabase(row)
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event({ id: ORDER_ID }))

    expect(res.order.items[0].image).toBe('https://signed.example/the-real-path.jpg')
    expect(supabase._signCalls).toEqual([{ bucket: ORDER_IMAGE_BUCKET, path: 'the-real-path.jpg', expiresIn: expect.any(Number) }])
  })

  it('an item with no image never calls Storage and stays null', async () => {
    const row = {
      id: ORDER_ID, order_number: 1, source: 'instagram', status: 'paid', currency: 'USD',
      order_items: [{ product_name: 'Catalogue item', image: null, is_custom: false, quantity: 1 }]
    }
    const supabase = fakeSupabase(row)
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event({ id: ORDER_ID }))

    expect(res.order.items[0].image).toBeNull()
    expect(supabase._signCalls).toEqual([])
  })

  it('signs each item independently — one broken/missing image never blanks the others', async () => {
    const row = {
      id: ORDER_ID, order_number: 1, source: 'instagram', status: 'paid', currency: 'USD',
      order_items: [
        { product_name: 'A', image: STORED_IMAGE, is_custom: true, quantity: 1 },
        { product_name: 'B', image: null, is_custom: false, quantity: 1 },
        { product_name: 'C', image: `https://proj.supabase.co/storage/v1/object/public/${ORDER_IMAGE_BUCKET}/other.jpg`, is_custom: true, quantity: 1 }
      ]
    }
    const supabase = fakeSupabase(row)
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event({ id: ORDER_ID }))

    expect(res.order.items[0].image).toBe('https://signed.example/the-real-path.jpg')
    expect(res.order.items[1].image).toBeNull()
    expect(res.order.items[2].image).toBe('https://signed.example/other.jpg')
  })

  it("a catalogue item's static/non-order-images image is passed through COMPLETELY UNCHANGED — never blanked, never signed (regression check: real production rows mix catalogue paths and order-images bucket URLs in this same column)", async () => {
    const row = {
      id: ORDER_ID, order_number: 1, source: 'instagram', status: 'paid', currency: 'USD',
      order_items: [
        { product_name: 'Catalogue top', image: '/images/products/bm-colada-top/01.jpg', is_custom: false, quantity: 1 },
        { product_name: 'Catalogue one-piece', image: 'https://proj.supabase.co/storage/v1/object/public/product-images/abc.jpg', is_custom: false, quantity: 1 }
      ]
    }
    const supabase = fakeSupabase(row)
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event({ id: ORDER_ID }))

    expect(res.order.items[0].image).toBe('/images/products/bm-colada-top/01.jpg')
    expect(res.order.items[1].image).toBe('https://proj.supabase.co/storage/v1/object/public/product-images/abc.jpg')
    expect(supabase._signCalls).toEqual([]) // never even attempted — neither matches the order-images bucket
  })

  it('a path can only ever be signed if it came from THIS order id\'s own fetched row — a different id never reuses it', async () => {
    const row = {
      id: ORDER_ID, order_number: 1, source: 'instagram', status: 'paid', currency: 'USD',
      order_items: [{ product_name: 'Custom', image: STORED_IMAGE, is_custom: true, quantity: 1 }]
    }
    const supabase = fakeSupabase(row)
    supabaseAdmin.mockReturnValue(supabase)

    // A different (guessed/modified) order id finds no row at all — 404, no signing attempted.
    const res = await handler(event({ id: 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee' }))
    expect(res).toMatchObject({ error: expect.any(String) })
    expect(supabase._signCalls).toEqual([])
  })
})
