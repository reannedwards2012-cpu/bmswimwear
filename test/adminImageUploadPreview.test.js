import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Phase 2 security hardening — both admin image-upload endpoints
 * (order reference images, quote inspiration images) now return a
 * short-lived `previewUrl` alongside the unchanged canonical `url`, so the
 * admin can see what they just uploaded before the record is saved, even
 * though the bucket is private and `url` itself is no longer fetchable.
 */

vi.mock('../server/utils/authUser.js', () => ({ requireAdmin: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))

import { requireAdmin } from '../server/utils/authUser.js'
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('setResponseStatus', (e, s) => { e._status = s })
  vi.stubGlobal('readMultipartFormData', async (e) => e._parts)
}

const fakeFilePart = (overrides = {}) => ({
  name: 'file',
  filename: 'photo.jpg',
  type: 'image/jpeg',
  data: Buffer.from('fake-image-bytes'),
  ...overrides
})
const event = (parts) => ({ _parts: parts, _status: 200 })

function fakeSupabaseStorage(bucket) {
  const signCalls = []
  return {
    _signCalls: signCalls,
    storage: {
      from(b) {
        expect(b).toBe(bucket)
        return {
          upload: () => Promise.resolve({ error: null }),
          getPublicUrl: (path) => ({ data: { publicUrl: `https://proj.supabase.co/storage/v1/object/public/${bucket}/${path}` } }),
          createSignedUrl: (path, expiresIn) => {
            signCalls.push({ path, expiresIn })
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
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('POST /api/admin/orders/image', () => {
  it('returns both the canonical url and a short-lived signed previewUrl', async () => {
    const supabase = fakeSupabaseStorage('order-images')
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/orders/image.post.js')).default

    const res = await handler(event([fakeFilePart()]))

    expect(res.url).toMatch(/^https:\/\/proj\.supabase\.co\/storage\/v1\/object\/public\/order-images\//)
    expect(res.previewUrl).toMatch(/^https:\/\/signed\.example\//)
    expect(supabase._signCalls).toHaveLength(1)
  })

  it('falls back to the canonical url as previewUrl if signing fails, rather than breaking the upload response', async () => {
    const supabase = fakeSupabaseStorage('order-images')
    supabase.storage.from = () => ({
      upload: () => Promise.resolve({ error: null }),
      getPublicUrl: (path) => ({ data: { publicUrl: `https://proj.supabase.co/storage/v1/object/public/order-images/${path}` } }),
      createSignedUrl: () => Promise.resolve({ data: null, error: { message: 'boom' } })
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/orders/image.post.js')).default

    const res = await handler(event([fakeFilePart()]))
    expect(res.previewUrl).toBe(res.url)
  })
})

describe('POST /api/admin/quotes/inspiration-image', () => {
  it('returns both the canonical url and a short-lived signed previewUrl', async () => {
    const supabase = fakeSupabaseStorage('quote-inspiration-images')
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/quotes/inspiration-image.post.js')).default

    const res = await handler(event([fakeFilePart()]))

    expect(res.url).toMatch(/^https:\/\/proj\.supabase\.co\/storage\/v1\/object\/public\/quote-inspiration-images\//)
    expect(res.previewUrl).toMatch(/^https:\/\/signed\.example\//)
    expect(supabase._signCalls).toHaveLength(1)
  })
})
