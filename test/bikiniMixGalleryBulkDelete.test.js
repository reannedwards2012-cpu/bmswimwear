import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { createFakeSupabase } from './helpers/fakeSupabase.js'

vi.mock('../server/utils/authUser.js', () => ({ requireAdmin: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))

import { requireAdmin } from '../server/utils/authUser.js'
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'

let MAX_BULK_IDS

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('readBody', async (e) => e._body)
  vi.stubGlobal('setResponseStatus', (e, s) => {
    e._status = s
  })
}
const event = (body) => ({ _body: body, _status: 200 })
const ID_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const ID_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

beforeAll(async () => {
  stubGlobals()
  const mod = await import('../server/api/admin/bikini-mix/gallery/bulk-delete.post.js')
  MAX_BULK_IDS = mod.MAX_BULK_IDS
})
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function loadHandler() {
  stubGlobals()
  return (await import('../server/api/admin/bikini-mix/gallery/bulk-delete.post.js')).default
}

describe('POST /api/admin/bikini-mix/gallery/bulk-delete', () => {
  it('non-admin cannot bulk-delete — zero Supabase calls', async () => {
    requireAdmin.mockRejectedValue(Object.assign(new Error('Admin access required'), { statusCode: 403 }))
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler()
    await expect(handler(event({ ids: [ID_A] }))).rejects.toThrow('Admin access required')
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('empty ids -> 400', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const ev = event({ ids: [] })
    await handler(ev)
    expect(ev._status).toBe(400)
  })

  it(`more than ${MAX_BULK_IDS} ids -> 400`, async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const tooMany = Array.from({ length: MAX_BULK_IDS + 1 }, (_, i) => `aaaaaaaa-aaaa-aaaa-aaaa-${String(i).padStart(12, '0')}`)
    const res = await handler(event({ ids: tooMany }))
    expect(res.error).toBeTruthy()
  })

  it('malformed id rejects the whole batch', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const ev = event({ ids: [ID_A, 'bad'] })
    await handler(ev)
    expect(ev._status).toBe(400)
  })

  it('deletes rows and cleans up Storage, reports the real deleted count', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([
      {
        data: [
          { id: ID_A, image_url: 'https://proj.supabase.co/storage/v1/object/public/bikini-mix-media/a.jpg' },
          { id: ID_B, image_url: 'https://proj.supabase.co/storage/v1/object/public/bikini-mix-media/b.jpg' }
        ],
        error: null
      }
    ])
    const storageRemove = vi.fn().mockResolvedValue({ error: null })
    supabase.storage = { from: () => ({ remove: storageRemove }) }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A, ID_B] }))
    expect(res).toEqual({ ok: true, deletedCount: 2, requestedCount: 2 })
    expect(storageRemove).toHaveBeenCalledWith(['a.jpg', 'b.jpg'])
  })

  it('a delete matching fewer rows than requested reports the real count, not the requested one', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([{ data: [{ id: ID_A, image_url: null }], error: null }])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A, ID_B] }))
    expect(res).toEqual({ ok: true, deletedCount: 1, requestedCount: 2 })
  })

  it('migration-not-applied -> 503, configured:false', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([{ data: null, error: { code: '42P01', message: 'relation does not exist' } }])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const ev = event({ ids: [ID_A] })
    const res = await handler(ev)
    expect(ev._status).toBe(503)
    expect(res.configured).toBe(false)
  })

  it('a genuine DB error -> 500', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([{ data: null, error: { message: 'db down' } }])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const ev = event({ ids: [ID_A] })
    const res = await handler(ev)
    expect(ev._status).toBe(500)
    expect(res.error).toBeTruthy()
  })
})
