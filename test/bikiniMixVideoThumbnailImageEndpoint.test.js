import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * POST /api/admin/bikini-mix/video-thumbnail-image — plain server-side
 * multipart upload (mirrors server/api/admin/fabrics/image.post.js), used
 * by the admin "Video thumbnail" control. Capped at 5MB, safely under
 * Netlify's synchronous-function payload ceiling — unlike the promo video
 * itself, this is NOT the proxy-through-a-function bug.
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

const fakeFilePart = (overrides = {}) => ({ name: 'file', filename: 'poster.jpg', type: 'image/jpeg', data: Buffer.from('x'.repeat(1000)), ...overrides })
const uploadEvent = (parts) => ({ _parts: parts, _status: 200 })

beforeEach(() => {
  stubGlobals()
  requireAdmin.mockReset().mockResolvedValue({ id: 'admin-1' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('POST /api/admin/bikini-mix/video-thumbnail-image', () => {
  it('uploads the file under a thumbnails/ prefix and returns its public URL', async () => {
    const uploadSpy = vi.fn(async () => ({ error: null }))
    const supabase = {
      storage: {
        from: () => ({
          upload: uploadSpy,
          getPublicUrl: (path) => ({ data: { publicUrl: `https://proj.supabase.co/storage/v1/object/public/bikini-mix-media/${path}` } })
        })
      }
    }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/video-thumbnail-image.post.js')).default

    const res = await handler(uploadEvent([fakeFilePart()]))

    expect(uploadSpy).toHaveBeenCalledWith(expect.stringMatching(/^thumbnails\//), expect.any(Buffer), { contentType: 'image/jpeg', upsert: false })
    expect(res.url).toMatch(/^https:\/\/proj\.supabase\.co\/storage\/v1\/object\/public\/bikini-mix-media\/thumbnails\//)
  })

  it('never passes upsert:true — a replacement upload must never silently overwrite an existing object', async () => {
    const uploadSpy = vi.fn(async () => ({ error: null }))
    const supabase = { storage: { from: () => ({ upload: uploadSpy, getPublicUrl: () => ({ data: { publicUrl: 'x' } }) }) } }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/video-thumbnail-image.post.js')).default

    await handler(uploadEvent([fakeFilePart()]))

    expect(uploadSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Buffer), expect.objectContaining({ upsert: false }))
  })

  it('rejects a file over 5MB before ever touching Storage', async () => {
    const uploadSpy = vi.fn()
    const supabase = { storage: { from: () => ({ upload: uploadSpy }) } }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/video-thumbnail-image.post.js')).default

    const res = await handler(uploadEvent([fakeFilePart({ data: Buffer.alloc(6 * 1024 * 1024) })]))

    expect(res).toMatchObject({ error: expect.stringContaining('5MB') })
    expect(uploadSpy).not.toHaveBeenCalled()
  })

  it('rejects an unsupported file type', async () => {
    const supabase = { storage: { from: () => ({ upload: vi.fn() }) } }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/video-thumbnail-image.post.js')).default

    const res = await handler(uploadEvent([fakeFilePart({ type: 'video/mp4' })]))
    expect(res).toMatchObject({ error: expect.stringContaining('JPEG, PNG or WebP') })
  })

  it('rejects when no file was uploaded', async () => {
    const supabase = { storage: { from: () => ({ upload: vi.fn() }) } }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/video-thumbnail-image.post.js')).default

    const res = await handler(uploadEvent([]))
    expect(res).toMatchObject({ error: expect.any(String) })
  })

  it('surfaces a clear error if the Storage upload itself fails', async () => {
    const supabase = { storage: { from: () => ({ upload: async () => ({ error: { message: 'boom' } }) }) } }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/video-thumbnail-image.post.js')).default

    const res = await handler(uploadEvent([fakeFilePart()]))
    expect(res).toMatchObject({ error: expect.any(String) })
  })

  it('requires admin — unauthorized requests never reach Storage', async () => {
    requireAdmin.mockRejectedValueOnce(Object.assign(new Error('Sign in required'), { statusCode: 401 }))
    const uploadSpy = vi.fn()
    const supabase = { storage: { from: () => ({ upload: uploadSpy }) } }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/video-thumbnail-image.post.js')).default

    await expect(handler(uploadEvent([fakeFilePart()]))).rejects.toMatchObject({ statusCode: 401 })
    expect(uploadSpy).not.toHaveBeenCalled()
  })
})
