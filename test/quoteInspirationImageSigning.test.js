import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  signQuoteInspirationImageUrl,
  signQuoteInspirationImageUrls,
  QUOTE_INSPIRATION_IMAGE_BUCKET,
  QUOTE_INSPIRATION_SIGNED_URL_TTL_SECONDS
} from '../server/utils/quoteInspirationImages.js'

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

const storedUrl = (name) => `https://proj.supabase.co/storage/v1/object/public/${QUOTE_INSPIRATION_IMAGE_BUCKET}/${name}`

describe('signQuoteInspirationImageUrl (single)', () => {
  it('signs with the default TTL in the right bucket', async () => {
    const supabase = fakeSupabaseStorage()
    const result = await signQuoteInspirationImageUrl(supabase, storedUrl('one.jpg'))
    expect(result).toBe(`https://signed.example/${QUOTE_INSPIRATION_IMAGE_BUCKET}/one.jpg`)
    expect(supabase._calls).toEqual([{ bucket: QUOTE_INSPIRATION_IMAGE_BUCKET, path: 'one.jpg', expiresIn: QUOTE_INSPIRATION_SIGNED_URL_TTL_SECONDS }])
  })
})

describe('signQuoteInspirationImageUrls (array)', () => {
  it('returns a parallel array, same length/order, one signed URL per stored URL', async () => {
    const supabase = fakeSupabaseStorage()
    const stored = [storedUrl('a.jpg'), storedUrl('b.jpg'), storedUrl('c.jpg')]
    const result = await signQuoteInspirationImageUrls(supabase, stored)
    expect(result).toEqual([
      `https://signed.example/${QUOTE_INSPIRATION_IMAGE_BUCKET}/a.jpg`,
      `https://signed.example/${QUOTE_INSPIRATION_IMAGE_BUCKET}/b.jpg`,
      `https://signed.example/${QUOTE_INSPIRATION_IMAGE_BUCKET}/c.jpg`
    ])
  })

  it('a non-matching entry resolves to null in its own slot, without breaking the others', async () => {
    const supabase = fakeSupabaseStorage()
    const stored = [storedUrl('a.jpg'), 'not-a-url', storedUrl('c.jpg')]
    const result = await signQuoteInspirationImageUrls(supabase, stored)
    expect(result).toEqual([
      `https://signed.example/${QUOTE_INSPIRATION_IMAGE_BUCKET}/a.jpg`,
      null,
      `https://signed.example/${QUOTE_INSPIRATION_IMAGE_BUCKET}/c.jpg`
    ])
  })

  it('gracefully returns [] for a non-array / missing input, never throws', async () => {
    const supabase = fakeSupabaseStorage()
    expect(await signQuoteInspirationImageUrls(supabase, null)).toEqual([])
    expect(await signQuoteInspirationImageUrls(supabase, undefined)).toEqual([])
  })
})
