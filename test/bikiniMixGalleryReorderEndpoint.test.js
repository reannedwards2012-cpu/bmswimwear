import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../server/utils/authUser.js', () => ({ requireAdmin: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))

import { requireAdmin } from '../server/utils/authUser.js'
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('setResponseStatus', (e, s) => { e._status = s })
  vi.stubGlobal('readBody', async (e) => e._body)
}

const postEvent = (body) => ({ _body: body, _status: 200 })
const ID_A = 'aaaaaaaa-0000-0000-0000-000000000001'
const ID_B = 'aaaaaaaa-0000-0000-0000-000000000002'
const ID_C = 'aaaaaaaa-0000-0000-0000-000000000003'

beforeEach(() => {
  stubGlobals()
  requireAdmin.mockReset().mockResolvedValue({ id: 'admin-1' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function supabaseWithRows(rows) {
  const updateCalls = []
  return {
    supabase: {
      from: () => ({
        select: () => Promise.resolve({ data: rows, error: null }),
        update: (patch) => ({
          eq: (col, id) => {
            updateCalls.push({ ...patch, id })
            return Promise.resolve({ error: null })
          }
        })
      })
    },
    updateCalls
  }
}

describe('POST /api/admin/bikini-mix/gallery/reorder', () => {
  it('rewrites sort_order to match the given array, in order', async () => {
    const { supabase, updateCalls } = supabaseWithRows([{ id: ID_A }, { id: ID_B }, { id: ID_C }])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/gallery/reorder.post.js')).default

    const res = await handler(postEvent({ order: [ID_C, ID_A, ID_B] }))

    expect(res).toEqual({ ok: true, reorderedCount: 3 })
    expect(updateCalls).toEqual([
      { sort_order: 0, id: ID_C },
      { sort_order: 1, id: ID_A },
      { sort_order: 2, id: ID_B }
    ])
  })

  it('ignores ids that do not belong to any existing row', async () => {
    const UNKNOWN = 'aaaaaaaa-0000-0000-0000-000000000099'
    const { supabase, updateCalls } = supabaseWithRows([{ id: ID_A }, { id: ID_B }])
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/gallery/reorder.post.js')).default

    const res = await handler(postEvent({ order: [ID_B, UNKNOWN, ID_A] }))

    expect(res).toEqual({ ok: true, reorderedCount: 2 })
    expect(updateCalls).toEqual([{ sort_order: 0, id: ID_B }, { sort_order: 1, id: ID_A }])
  })

  it('rejects a missing/empty order array without touching the database', async () => {
    const readSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: () => ({ select: readSpy }) })
    const handler = (await import('../server/api/admin/bikini-mix/gallery/reorder.post.js')).default

    const res = await handler(postEvent({ order: [] }))

    expect(res).toMatchObject({ error: expect.any(String) })
    expect(readSpy).not.toHaveBeenCalled()
  })

  it('rejects malformed (non-UUID) ids', async () => {
    const readSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: () => ({ select: readSpy }) })
    const handler = (await import('../server/api/admin/bikini-mix/gallery/reorder.post.js')).default

    const res = await handler(postEvent({ order: ['not-a-uuid'] }))

    expect(res).toMatchObject({ error: expect.any(String) })
    expect(readSpy).not.toHaveBeenCalled()
  })

  it('returns 503 when the migration has not been applied yet', async () => {
    supabaseAdmin.mockReturnValue({ from: () => ({ select: () => Promise.resolve({ data: null, error: { code: '42P01', message: 'missing table' } }) }) })
    const handler = (await import('../server/api/admin/bikini-mix/gallery/reorder.post.js')).default

    const event = postEvent({ order: [ID_A] })
    const res = await handler(event)

    expect(event._status).toBe(503)
    expect(res).toMatchObject({ configured: false })
  })

  it('requires admin', async () => {
    requireAdmin.mockRejectedValueOnce(Object.assign(new Error('Sign in required'), { statusCode: 401 }))
    supabaseAdmin.mockReturnValue({ from: () => ({}) })
    const handler = (await import('../server/api/admin/bikini-mix/gallery/reorder.post.js')).default

    await expect(handler(postEvent({ order: [ID_A] }))).rejects.toMatchObject({ statusCode: 401 })
  })
})
