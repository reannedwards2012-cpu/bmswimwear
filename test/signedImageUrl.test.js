import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSignedStorageUrl } from '../server/utils/signedImageUrl.js'

/**
 * Phase 2 security hardening — the generic private-bucket signed-URL
 * helper shared by orderImages.js / quoteInspirationImages.js.
 */

function fakeSupabaseStorage({ signedUrl, error } = {}) {
  const calls = []
  return {
    _calls: calls,
    storage: {
      from(bucket) {
        return {
          createSignedUrl(path, expiresIn) {
            calls.push({ bucket, path, expiresIn })
            if (error) return Promise.resolve({ data: null, error })
            return Promise.resolve({ data: { signedUrl: signedUrl ?? `https://signed.example/${bucket}/${path}?ttl=${expiresIn}` }, error: null })
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

describe('createSignedStorageUrl', () => {
  it('returns null immediately, without calling Storage, for a falsy path', async () => {
    const supabase = fakeSupabaseStorage()
    const result = await createSignedStorageUrl(supabase, 'order-images', null, 900)
    expect(result).toBeNull()
    expect(supabase._calls).toEqual([])
  })

  it('signs the exact bucket/path/ttl it was given', async () => {
    const supabase = fakeSupabaseStorage({ signedUrl: 'https://signed.example/ok' })
    const result = await createSignedStorageUrl(supabase, 'order-images', 'abc.jpg', 1800)
    expect(result).toBe('https://signed.example/ok')
    expect(supabase._calls).toEqual([{ bucket: 'order-images', path: 'abc.jpg', expiresIn: 1800 }])
  })

  it('returns null (never throws) when Storage reports an error, and never logs the path', async () => {
    const errorSpy = vi.spyOn(console, 'error')
    const supabase = fakeSupabaseStorage({ error: { message: 'object not found' } })
    const result = await createSignedStorageUrl(supabase, 'order-images', 'super-secret-path.jpg', 900)
    expect(result).toBeNull()
    const logged = errorSpy.mock.calls.flat().join(' ')
    expect(logged).not.toContain('super-secret-path.jpg')
  })

  it('returns null (never throws) if the Storage call itself throws', async () => {
    const supabase = { storage: { from: () => ({ createSignedUrl: () => { throw new Error('network blip') } }) } }
    const result = await createSignedStorageUrl(supabase, 'order-images', 'a.jpg', 900)
    expect(result).toBeNull()
  })

  it('never logs the signed URL itself (it is a bearer credential for the file)', async () => {
    const errorSpy = vi.spyOn(console, 'error')
    const supabase = fakeSupabaseStorage({ error: { message: 'boom' } })
    await createSignedStorageUrl(supabase, 'order-images', 'a.jpg', 900)
    const logged = errorSpy.mock.calls.flat().join(' ')
    expect(logged).not.toMatch(/https?:\/\//)
  })
})
