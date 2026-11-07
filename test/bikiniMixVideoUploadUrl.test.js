import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Video upload hang fix — server/api/admin/bikini-mix/video-upload-url.post.js
 * replaces the old video.post.js, which proxied the entire file through this
 * Nitro/Netlify function (broken for any real video — see its deletion and
 * the new endpoint's header comment for the full root-cause). This endpoint
 * does the opposite: it carries no file data at all, just mints a signed
 * upload URL the browser then uses to upload DIRECTLY to Supabase Storage.
 */

vi.mock('../server/utils/authUser.js', () => ({ requireAdmin: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))

import { requireAdmin } from '../server/utils/authUser.js'
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('setResponseStatus', (e, s) => { e._status = s })
  vi.stubGlobal('readBody', async (e) => e._body)
}
const event = (body) => ({ _body: body, _status: 200 })

function fakeSupabase({ signError = null } = {}) {
  const calls = []
  return {
    _calls: calls,
    storage: {
      from(bucket) {
        return {
          // Matches real Supabase behavior: the response's `path` echoes
          // back exactly what was passed in.
          createSignedUploadUrl: (path, opts) => {
            calls.push({ op: 'sign', bucket, path, opts })
            if (signError) return Promise.resolve({ data: null, error: signError })
            return Promise.resolve({ data: { signedUrl: 'https://signed.example/upload', token: 'tok-abc', path }, error: null })
          },
          getPublicUrl: (path) => {
            calls.push({ op: 'publicUrl', bucket, path })
            return { data: { publicUrl: `https://proj.supabase.co/storage/v1/object/public/${bucket}/${path}` } }
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
  handler = (await import('../server/api/admin/bikini-mix/video-upload-url.post.js')).default
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('POST /api/admin/bikini-mix/video-upload-url', () => {
  it('returns a signed upload URL, token, path, and the eventual public URL for an allowed video type', async () => {
    const supabase = fakeSupabase()
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event({ contentType: 'video/mp4' }))

    expect(res.signedUrl).toBe('https://signed.example/upload')
    expect(res.token).toBe('tok-abc')
    expect(res.path).toMatch(/^[0-9a-f-]{36}\.mp4$/)
    expect(res.publicUrl).toBe(`https://proj.supabase.co/storage/v1/object/public/bikini-mix-media/${res.path}`)
  })

  it('never passes upsert:true — a replacement upload must never silently overwrite an existing object at a reused path', async () => {
    const supabase = fakeSupabase()
    supabaseAdmin.mockReturnValue(supabase)

    await handler(event({ contentType: 'video/mp4' }))

    expect(supabase._calls[0]).toMatchObject({ op: 'sign', opts: { upsert: false } })
  })

  it('rejects an unsupported content type before ever calling Storage', async () => {
    const supabase = fakeSupabase()
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event({ contentType: 'application/pdf' }))

    expect(res).toMatchObject({ error: expect.stringContaining('MP4, WebM or MOV') })
    expect(supabase._calls).toEqual([])
  })

  it('rejects a missing/empty body the same way', async () => {
    const supabase = fakeSupabase()
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event(null))
    expect(res).toMatchObject({ error: expect.any(String) })
    expect(supabase._calls).toEqual([])
  })

  it('accepts each of the three allowed video types', async () => {
    const supabase = fakeSupabase()
    supabaseAdmin.mockReturnValue(supabase)

    for (const type of ['video/mp4', 'video/webm', 'video/quicktime']) {
      const res = await handler(event({ contentType: type }))
      expect(res.signedUrl).toBeDefined()
    }
  })

  it('surfaces a clear error if Storage signing fails, never throwing a raw error to the client', async () => {
    const supabase = fakeSupabase({ signError: { message: 'boom' } })
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event({ contentType: 'video/mp4' }))
    expect(res).toMatchObject({ error: expect.any(String) })
  })

  it('requires admin — unauthorized requests never reach Storage', async () => {
    requireAdmin.mockRejectedValueOnce(Object.assign(new Error('Sign in required'), { statusCode: 401 }))
    const supabase = fakeSupabase()
    supabaseAdmin.mockReturnValue(supabase)

    await expect(handler(event({ contentType: 'video/mp4' }))).rejects.toMatchObject({ statusCode: 401 })
    expect(supabase._calls).toEqual([])
  })
})
