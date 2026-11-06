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
  const mod = await import('../server/api/admin/products/bulk-status.post.js')
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
  return (await import('../server/api/admin/products/bulk-status.post.js')).default
}

describe('POST /api/admin/products/bulk-status', () => {
  it('non-admin cannot bulk-update — zero Supabase calls', async () => {
    requireAdmin.mockRejectedValue(Object.assign(new Error('Admin access required'), { statusCode: 403 }))
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler()
    await expect(handler(event({ ids: [ID_A], isActive: false }))).rejects.toThrow('Admin access required')
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('missing isActive -> 400', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const ev = event({ ids: [ID_A] })
    await handler(ev)
    expect(ev._status).toBe(400)
  })

  it(`more than ${MAX_BULK_IDS} ids -> 400`, async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const tooMany = Array.from({ length: MAX_BULK_IDS + 1 }, (_, i) => `aaaaaaaa-aaaa-aaaa-aaaa-${String(i).padStart(12, '0')}`)
    const res = await handler(event({ ids: tooMany, isActive: false }))
    expect(res.error).toBeTruthy()
  })

  it('malformed id rejects the whole batch', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const handler = await loadHandler()
    const ev = event({ ids: [ID_A, 'bad'], isActive: false })
    await handler(ev)
    expect(ev._status).toBe(400)
  })

  it('deactivates the selected products, reports the real updated count', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([{ data: [{ id: ID_A }], error: null }])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A, ID_B], isActive: false }))
    expect(res).toEqual({ ok: true, updatedCount: 1, requestedCount: 2 })
    expect(supabase._calls[0].payload).toEqual({ is_active: false })
  })

  it('activates (isActive: true)', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([{ data: [{ id: ID_A }, { id: ID_B }], error: null }])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A, ID_B], isActive: true }))
    expect(res.updatedCount).toBe(2)
  })

  it('DB error -> 500', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = createFakeSupabase([{ data: null, error: { message: 'db down' } }])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const ev = event({ ids: [ID_A], isActive: false })
    const res = await handler(ev)
    expect(ev._status).toBe(500)
    expect(res.error).toBeTruthy()
  })
})
