import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Swimsuit Mixer image-upload review — the gallery's single upload/delete
 * endpoints had no direct test coverage. Unlike the video, these images are
 * capped at 5MB — safely under Netlify's synchronous-function payload
 * ceiling — so the proxy-through-a-function pattern here is NOT the video
 * bug; this is confirming it actually works, not fixing it.
 */

vi.mock('../server/utils/authUser.js', () => ({ requireAdmin: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))

import { requireAdmin } from '../server/utils/authUser.js'
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('setResponseStatus', (e, s) => { e._status = s })
  vi.stubGlobal('readMultipartFormData', async (e) => e._parts)
  vi.stubGlobal('getRouterParam', (e, k) => e._params?.[k])
}

const fakeFilePart = (overrides = {}) => ({ name: 'file', filename: 'bead.jpg', type: 'image/jpeg', data: Buffer.from('x'.repeat(1000)), ...overrides })
const fieldPart = (name, value) => ({ name, data: Buffer.from(String(value)) })
const uploadEvent = (parts) => ({ _parts: parts, _status: 200 })
const deleteEvent = (params) => ({ _params: params, _status: 200 })

const VALID_FIELDS = [fieldPart('category', 'bead'), fieldPart('caption', 'Gold chain'), fieldPart('includedInTicket', 'true')]
const GALLERY_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

beforeEach(() => {
  stubGlobals()
  requireAdmin.mockReset().mockResolvedValue({ id: 'admin-1' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('POST /api/admin/bikini-mix/gallery/image', () => {
  it('uploads the file and inserts the gallery row in one step', async () => {
    const uploadSpy = vi.fn(async () => ({ error: null }))
    const insertedRow = { id: GALLERY_ID, image_url: 'https://proj.supabase.co/storage/v1/object/public/bikini-mix-media/gallery/x.jpg', caption: 'Gold chain', category: 'bead', included_in_ticket: true, sort_order: null, is_active: true, created_at: '2026-01-01' }
    const supabase = {
      storage: { from: () => ({ upload: uploadSpy, getPublicUrl: (path) => ({ data: { publicUrl: `https://proj.supabase.co/storage/v1/object/public/bikini-mix-media/${path}` } }) }) },
      from: () => ({ insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: insertedRow, error: null }) }) }) })
    }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/gallery/image.post.js')).default

    const res = await handler(uploadEvent([fakeFilePart(), ...VALID_FIELDS]))

    expect(uploadSpy).toHaveBeenCalledWith(expect.stringMatching(/^gallery\//), expect.any(Buffer), { contentType: 'image/jpeg', upsert: false })
    expect(res.image).toMatchObject({ id: GALLERY_ID, caption: 'Gold chain', includedInTicket: true })
  })

  it('rejects a file over 5MB before ever touching Storage', async () => {
    const uploadSpy = vi.fn()
    const supabase = { storage: { from: () => ({ upload: uploadSpy }) } }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/gallery/image.post.js')).default

    const res = await handler(uploadEvent([fakeFilePart({ data: Buffer.alloc(6 * 1024 * 1024) }), ...VALID_FIELDS]))

    expect(res).toMatchObject({ error: expect.stringContaining('5MB') })
    expect(uploadSpy).not.toHaveBeenCalled()
  })

  it('rejects an unsupported file type', async () => {
    const supabase = { storage: { from: () => ({ upload: vi.fn() }) } }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/gallery/image.post.js')).default

    const res = await handler(uploadEvent([fakeFilePart({ type: 'application/pdf' }), ...VALID_FIELDS]))
    expect(res).toMatchObject({ error: expect.stringContaining('JPEG, PNG or WebP') })
  })

  it('rejects invalid gallery fields (e.g. bad category) without uploading', async () => {
    const uploadSpy = vi.fn()
    const supabase = { storage: { from: () => ({ upload: uploadSpy }) } }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/gallery/image.post.js')).default

    const res = await handler(uploadEvent([fakeFilePart(), fieldPart('category', 'not-a-real-category')]))
    expect(res).toMatchObject({ error: expect.any(String) })
    expect(uploadSpy).not.toHaveBeenCalled()
  })

  it('requires admin', async () => {
    requireAdmin.mockRejectedValueOnce(Object.assign(new Error('Sign in required'), { statusCode: 401 }))
    const supabase = { storage: { from: () => ({ upload: vi.fn() }) } }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/gallery/image.post.js')).default

    await expect(handler(uploadEvent([fakeFilePart(), ...VALID_FIELDS]))).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('DELETE /api/admin/bikini-mix/gallery/:id', () => {
  it('deletes the row and removes the Storage object it pointed to', async () => {
    const removeSpy = vi.fn(async () => ({ error: null }))
    const supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { image_url: 'https://proj.supabase.co/storage/v1/object/public/bikini-mix-media/gallery/old.jpg' }, error: null }) }) }),
        delete: () => ({ eq: () => Promise.resolve({ error: null }) })
      }),
      storage: { from: () => ({ remove: removeSpy }) }
    }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/gallery/[id].delete.js')).default

    const res = await handler(deleteEvent({ id: GALLERY_ID }))

    expect(res).toEqual({ ok: true, id: GALLERY_ID })
    expect(removeSpy).toHaveBeenCalledWith(['gallery/old.jpg'])
  })

  it('still deletes the row even if Storage cleanup fails — a dangling DB row showing a broken image is worse than an orphaned file', async () => {
    const supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { image_url: 'https://proj.supabase.co/storage/v1/object/public/bikini-mix-media/gallery/old.jpg' }, error: null }) }) }),
        delete: () => ({ eq: () => Promise.resolve({ error: null }) })
      }),
      storage: { from: () => ({ remove: vi.fn(async () => ({ error: { message: 'boom' } })) }) }
    }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/gallery/[id].delete.js')).default

    const res = await handler(deleteEvent({ id: GALLERY_ID }))
    expect(res).toEqual({ ok: true, id: GALLERY_ID })
  })

  it('404s for a nonexistent id, never touching Storage', async () => {
    const removeSpy = vi.fn()
    const supabase = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }),
      storage: { from: () => ({ remove: removeSpy }) }
    }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/gallery/[id].delete.js')).default

    const res = await handler(deleteEvent({ id: GALLERY_ID }))
    expect(res).toMatchObject({ error: expect.any(String) })
    expect(removeSpy).not.toHaveBeenCalled()
  })

  it('requires admin', async () => {
    requireAdmin.mockRejectedValueOnce(Object.assign(new Error('Sign in required'), { statusCode: 401 }))
    const supabase = { from: () => ({}), storage: { from: () => ({}) } }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/gallery/[id].delete.js')).default

    await expect(handler(deleteEvent({ id: GALLERY_ID }))).rejects.toMatchObject({ statusCode: 401 })
  })
})
