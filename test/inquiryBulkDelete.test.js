import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'

/**
 * Endpoint-level coverage for POST /api/admin/inquiries/bulk-delete — same
 * stubbed-globals + mocked-requireAdmin/Supabase approach as
 * test/fabricDelete.test.js. Proves: admin gating, UUID validation on every
 * id (whole batch rejected, not silently filtered), the MAX_BULK_DELETE_IDS
 * cap, and that the reported deletedCount always reflects what Supabase
 * actually deleted (never just echoes the requested count).
 */

vi.mock('../server/utils/authUser.js', () => ({ requireAdmin: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))

import { requireAdmin } from '../server/utils/authUser.js'
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'

let MAX_BULK_DELETE_IDS

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
const ID_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

/** Tracks every call; `.delete().in('id', ids).select('id')` resolves `deleteResult`. */
function fakeSupabase(deleteResult = { data: [], error: null }) {
  const calls = []
  return {
    from(table) {
      const state = { table, op: null, inArgs: null }
      const api = {
        delete() {
          state.op = 'delete'
          return api
        },
        in(k, v) {
          state.inArgs = [k, v]
          return api
        },
        select() {
          calls.push({ table, op: state.op, inArgs: state.inArgs })
          return Promise.resolve(deleteResult)
        }
      }
      return api
    },
    _calls: calls
  }
}

beforeAll(async () => {
  stubGlobals()
  const mod = await import('../server/api/admin/inquiries/bulk-delete.post.js')
  MAX_BULK_DELETE_IDS = mod.MAX_BULK_DELETE_IDS
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
  return (await import('../server/api/admin/inquiries/bulk-delete.post.js')).default
}

describe('POST /api/admin/inquiries/bulk-delete', () => {
  it('non-admin cannot bulk-delete — zero Supabase calls', async () => {
    requireAdmin.mockRejectedValue(Object.assign(new Error('Admin access required'), { statusCode: 403 }))
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler()

    await expect(handler(event({ ids: [ID_A] }))).rejects.toThrow('Admin access required')
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('empty/missing ids -> 400, nothing touched', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler()

    for (const body of [{}, { ids: [] }, { ids: 'not-an-array' }, { ids: null }]) {
      const ev = event(body)
      const res = await handler(ev)
      expect(ev._status).toBe(400)
      expect(res.error).toBeTruthy()
    }
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('any malformed id rejects the WHOLE batch (400), nothing deleted — never silently skips bad ids', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler()

    const ev = event({ ids: [ID_A, 'not-a-uuid', ID_B] })
    const res = await handler(ev)

    expect(ev._status).toBe(400)
    expect(res.error).toBeTruthy()
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it(`more than ${MAX_BULK_DELETE_IDS} ids -> 400, nothing touched`, async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler()

    const tooMany = Array.from({ length: MAX_BULK_DELETE_IDS + 1 }, (_, i) => ID_A.replace(/a$/, String(i % 10)))
    const ev = event({ ids: tooMany })
    const res = await handler(ev)

    expect(ev._status).toBe(400)
    expect(res.error).toMatch(new RegExp(String(MAX_BULK_DELETE_IDS)))
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('exactly the cap is allowed through to the DB call', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = fakeSupabase({ data: [], error: null })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const atCap = Array.from({ length: MAX_BULK_DELETE_IDS }, (_, i) => `aaaaaaaa-aaaa-aaaa-aaaa-${String(i).padStart(12, '0')}`)
    const ev = event({ ids: atCap })
    const res = await handler(ev)

    expect(ev._status).toBe(200)
    expect(res.requestedCount).toBe(MAX_BULK_DELETE_IDS)
  })

  it('duplicate ids are de-duplicated before counting against the cap and before the DB call', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = fakeSupabase({ data: [{ id: ID_A }], error: null })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A, ID_A, ID_A] }))
    expect(res.requestedCount).toBe(1)
    expect(supabase._calls[0].inArgs).toEqual(['id', [ID_A]])
  })

  it('happy path: deletes the selected ids, returns the ACTUAL deleted count (not just the requested count)', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    // Only 2 of the 3 requested still existed (e.g. deleted by another admin moments earlier).
    const supabase = fakeSupabase({ data: [{ id: ID_A }, { id: ID_B }], error: null })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const ev = event({ ids: [ID_A, ID_B, ID_C] })
    const res = await handler(ev)

    expect(ev._status).toBe(200)
    expect(res).toEqual({ ok: true, deletedCount: 2, requestedCount: 3 })
    expect(supabase._calls[0]).toEqual({ table: 'inquiries', op: 'delete', inArgs: ['id', [ID_A, ID_B, ID_C]] })
  })

  it('DB error during delete -> 500, generic error', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = fakeSupabase({ data: null, error: { message: 'db down' } })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const ev = event({ ids: [ID_A] })
    const res = await handler(ev)

    expect(ev._status).toBe(500)
    expect(res.error).toBeTruthy()
  })

  it('a delete that matches nothing (already gone) is not an error — deletedCount: 0', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = fakeSupabase({ data: [], error: null })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ ids: [ID_A] }))
    expect(res).toEqual({ ok: true, deletedCount: 0, requestedCount: 1 })
  })
})
