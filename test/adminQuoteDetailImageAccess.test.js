import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Phase 2 security hardening — GET /api/admin/quotes/:id now ALSO returns
 * `inspirationImagePreviewUrls`: a parallel array of short-lived signed
 * URLs for display, alongside the UNCHANGED canonical `inspirationImageUrls`
 * (which the Quote Calculator form re-submits verbatim on save — it must
 * never be replaced with signed URLs, or saving would corrupt the stored
 * data with expiring links).
 */

vi.mock('../server/utils/authUser.js', () => ({ requireAdmin: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))

import { requireAdmin } from '../server/utils/authUser.js'
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'
import { QUOTE_INSPIRATION_IMAGE_BUCKET } from '../server/utils/quoteInspirationImages.js'

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('setResponseStatus', (e, s) => { e._status = s })
  vi.stubGlobal('getRouterParam', (e, k) => e._params?.[k])
}
const event = (params) => ({ _params: params, _status: 200 })

const QUOTE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const storedUrl = (name) => `https://proj.supabase.co/storage/v1/object/public/${QUOTE_INSPIRATION_IMAGE_BUCKET}/${name}`

function fakeSupabase(row) {
  const signCalls = []
  return {
    _signCalls: signCalls,
    from(table) {
      expect(table).toBe('quotes')
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }) }) }
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
  handler = (await import('../server/api/admin/quotes/[id].get.js')).default
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GET /api/admin/quotes/:id — unauthorized access', () => {
  it('requireAdmin rejecting means Storage is never touched', async () => {
    requireAdmin.mockRejectedValueOnce(Object.assign(new Error('Sign in required'), { statusCode: 401 }))
    const supabase = fakeSupabase({ id: QUOTE_ID, inspiration_image_urls: [storedUrl('x.jpg')] })
    supabaseAdmin.mockReturnValue(supabase)

    await expect(handler(event({ id: QUOTE_ID }))).rejects.toMatchObject({ statusCode: 401 })
    expect(supabase._signCalls).toEqual([])
  })
})

describe('GET /api/admin/quotes/:id — image signing', () => {
  it('keeps inspirationImageUrls canonical/unchanged while adding a parallel signed inspirationImagePreviewUrls array', async () => {
    const row = {
      id: QUOTE_ID, quote_number: 1, status: 'draft', customer_name: 'Jane',
      inspiration_image_urls: [storedUrl('one.jpg'), storedUrl('two.jpg')]
    }
    const supabase = fakeSupabase(row)
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event({ id: QUOTE_ID }))

    // Canonical array: byte-for-byte the stored values — safe to re-submit on save.
    expect(res.quote.inspirationImageUrls).toEqual([storedUrl('one.jpg'), storedUrl('two.jpg')])
    // Parallel display array: freshly-signed, same order/length.
    expect(res.quote.inspirationImagePreviewUrls).toEqual(['https://signed.example/one.jpg', 'https://signed.example/two.jpg'])
  })

  it('an empty inspiration-image list never calls Storage', async () => {
    const row = { id: QUOTE_ID, quote_number: 1, status: 'draft', customer_name: 'Jane', inspiration_image_urls: [] }
    const supabase = fakeSupabase(row)
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event({ id: QUOTE_ID }))

    expect(res.quote.inspirationImageUrls).toEqual([])
    expect(res.quote.inspirationImagePreviewUrls).toEqual([])
    expect(supabase._signCalls).toEqual([])
  })
})
