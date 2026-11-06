import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { signOrderImageUrl, ORDER_IMAGE_BUCKET, ORDER_IMAGE_SIGNED_URL_TTL_SECONDS } from '../server/utils/orderImages.js'

function fakeSupabaseStorage() {
  const calls = []
  return {
    _calls: calls,
    storage: {
      from(bucket) {
        return {
          createSignedUrl(path, expiresIn) {
            calls.push({ bucket, path, expiresIn })
            return Promise.resolve({ data: { signedUrl: `https://signed.example/${bucket}/${path}` }, error: null })
          }
        }
      }
    }
  }
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('signOrderImageUrl', () => {
  it('extracts the object path from a stored order-images public URL and signs it, in the right bucket, with the default TTL', async () => {
    const supabase = fakeSupabaseStorage()
    const stored = `https://proj.supabase.co/storage/v1/object/public/${ORDER_IMAGE_BUCKET}/abc-123.jpg`
    const result = await signOrderImageUrl(supabase, stored)
    expect(result).toBe(`https://signed.example/${ORDER_IMAGE_BUCKET}/abc-123.jpg`)
    expect(supabase._calls).toEqual([{ bucket: ORDER_IMAGE_BUCKET, path: 'abc-123.jpg', expiresIn: ORDER_IMAGE_SIGNED_URL_TTL_SECONDS }])
  })

  it('honours an explicit TTL override (used for the just-uploaded preview case)', async () => {
    const supabase = fakeSupabaseStorage()
    const stored = `https://proj.supabase.co/storage/v1/object/public/${ORDER_IMAGE_BUCKET}/abc-123.jpg`
    await signOrderImageUrl(supabase, stored, 3600)
    expect(supabase._calls[0].expiresIn).toBe(3600)
  })

  it('returns null and never calls Storage for null/missing/non-matching values', async () => {
    const supabase = fakeSupabaseStorage()
    expect(await signOrderImageUrl(supabase, null)).toBeNull()
    expect(await signOrderImageUrl(supabase, undefined)).toBeNull()
    expect(await signOrderImageUrl(supabase, 'not-a-url')).toBeNull()
    expect(await signOrderImageUrl(supabase, 'https://proj.supabase.co/storage/v1/object/public/some-other-bucket/x.jpg')).toBeNull()
    expect(supabase._calls).toEqual([])
  })
})
