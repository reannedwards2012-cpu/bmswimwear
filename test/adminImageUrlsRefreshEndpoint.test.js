import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Phase 2 follow-up — the two lightweight refresh endpoints
 * (GET /api/admin/orders/:id/image-urls, GET /api/admin/quotes/:id/image-urls)
 * exist purely to renew expiring signed URLs without re-fetching (or
 * risking disturbing) the full order/quote. Same access-control property
 * as the main detail endpoints: every signed URL is derived only from
 * THIS id's own just-fetched row, never a client-supplied path, and
 * unauthorized requests never reach Storage at all.
 */

vi.mock('../server/utils/authUser.js', () => ({ requireAdmin: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))

import { requireAdmin } from '../server/utils/authUser.js'
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'
import { ORDER_IMAGE_BUCKET } from '../server/utils/orderImages.js'
import { QUOTE_INSPIRATION_IMAGE_BUCKET } from '../server/utils/quoteInspirationImages.js'

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('setResponseStatus', (e, s) => { e._status = s })
  vi.stubGlobal('getRouterParam', (e, k) => e._params?.[k])
}
const event = (params) => ({ _params: params, _status: 200 })

const ORDER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const OTHER_ORDER_ID = 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee'
const QUOTE_ID = 'cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee'

function signingSupabase(bucket, rowsByFilter) {
  const signCalls = []
  return {
    _signCalls: signCalls,
    from(table) {
      return {
        select: () => ({
          eq: (col, val) => ({
            maybeSingle: () => Promise.resolve({ data: rowsByFilter(val) ?? null, error: null })
          })
        })
      }
    },
    storage: {
      from(b) {
        return {
          createSignedUrl(path, expiresIn) {
            signCalls.push({ bucket: b, path, expiresIn })
            return Promise.resolve({ data: { signedUrl: `https://signed.example/${path}` }, error: null })
          }
        }
      }
    }
  }
}

beforeEach(() => {
  stubGlobals()
  requireAdmin.mockReset().mockResolvedValue({ id: 'admin-1' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GET /api/admin/orders/:id/image-urls', () => {
  it('returns freshly-signed images keyed by item id, scoped to THIS order only', async () => {
    const supabase = signingSupabase(ORDER_IMAGE_BUCKET, (id) =>
      id === ORDER_ID
        ? {
            id: ORDER_ID, source: 'instagram', status: 'paid',
            order_items: [{ id: 'item-1', image: `https://proj.supabase.co/storage/v1/object/public/${ORDER_IMAGE_BUCKET}/a.jpg` }]
          }
        : null
    )
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/orders/[id]/image-urls.get.js')).default

    const res = await handler(event({ id: ORDER_ID }))
    expect(res.images).toEqual([{ id: 'item-1', image: 'https://signed.example/a.jpg' }])
  })

  it('a different (guessed) order id never reuses this order\'s signed path — 404, nothing signed', async () => {
    const supabase = signingSupabase(ORDER_IMAGE_BUCKET, (id) =>
      id === ORDER_ID ? { id: ORDER_ID, source: 'instagram', status: 'paid', order_items: [{ id: 'item-1', image: 'x' }] } : null
    )
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/orders/[id]/image-urls.get.js')).default

    const res = await handler(event({ id: OTHER_ORDER_ID }))
    expect(res).toMatchObject({ error: expect.any(String) })
    expect(supabase._signCalls).toEqual([])
  })

  it('leaves a catalogue item\'s image unchanged (never blanks it) — same pass-through rule as the full detail endpoint', async () => {
    const supabase = signingSupabase(ORDER_IMAGE_BUCKET, () => ({
      id: ORDER_ID, source: 'instagram', status: 'paid',
      order_items: [{ id: 'item-1', image: '/images/products/x/01.jpg' }]
    }))
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/orders/[id]/image-urls.get.js')).default

    const res = await handler(event({ id: ORDER_ID }))
    expect(res.images).toEqual([{ id: 'item-1', image: '/images/products/x/01.jpg' }])
    expect(supabase._signCalls).toEqual([])
  })

  it('unauthorized access never touches Storage', async () => {
    requireAdmin.mockRejectedValueOnce(Object.assign(new Error('Sign in required'), { statusCode: 401 }))
    const supabase = signingSupabase(ORDER_IMAGE_BUCKET, () => ({ id: ORDER_ID, order_items: [{ id: 'item-1', image: 'x' }] }))
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/orders/[id]/image-urls.get.js')).default

    await expect(handler(event({ id: ORDER_ID }))).rejects.toMatchObject({ statusCode: 401 })
    expect(supabase._signCalls).toEqual([])
  })
})

describe('GET /api/admin/quotes/:id/image-urls', () => {
  it('returns freshly-signed preview URLs, scoped to THIS quote only', async () => {
    const supabase = signingSupabase(QUOTE_INSPIRATION_IMAGE_BUCKET, (id) =>
      id === QUOTE_ID ? { id: QUOTE_ID, inspiration_image_urls: [`https://proj.supabase.co/storage/v1/object/public/${QUOTE_INSPIRATION_IMAGE_BUCKET}/a.jpg`] } : null
    )
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/quotes/[id]/image-urls.get.js')).default

    const res = await handler(event({ id: QUOTE_ID }))
    expect(res.previewUrls).toEqual(['https://signed.example/a.jpg'])
  })

  it('a different (guessed) quote id gets 404, nothing signed', async () => {
    const supabase = signingSupabase(QUOTE_INSPIRATION_IMAGE_BUCKET, (id) => (id === QUOTE_ID ? { id: QUOTE_ID, inspiration_image_urls: ['x'] } : null))
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/quotes/[id]/image-urls.get.js')).default

    const res = await handler(event({ id: 'dddddddd-bbbb-cccc-dddd-eeeeeeeeeeee' }))
    expect(res).toMatchObject({ error: expect.any(String) })
    expect(supabase._signCalls).toEqual([])
  })

  it('unauthorized access never touches Storage', async () => {
    requireAdmin.mockRejectedValueOnce(Object.assign(new Error('Admin access required'), { statusCode: 403 }))
    const supabase = signingSupabase(QUOTE_INSPIRATION_IMAGE_BUCKET, () => ({ id: QUOTE_ID, inspiration_image_urls: ['x'] }))
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/quotes/[id]/image-urls.get.js')).default

    await expect(handler(event({ id: QUOTE_ID }))).rejects.toMatchObject({ statusCode: 403 })
    expect(supabase._signCalls).toEqual([])
  })
})
