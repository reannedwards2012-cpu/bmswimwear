import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Endpoint-level coverage for DELETE /api/admin/fabrics/:id — same stubbed-
 * globals approach as test/stockistEndpoints.test.js / test/checkoutQuote.test.js.
 * The success path against a real Supabase project (product_fabrics cleanup,
 * fabric row delete, Storage image cleanup, zero orphans left behind) was
 * verified live and is reported separately, not re-asserted here — these
 * tests cover the failure/ordering guarantees that shouldn't be exercised
 * against production data: nothing is deleted on a cleanup failure, the
 * fabric is looked up before either delete, and a missing fabric 404s
 * without touching anything.
 */

vi.mock('../server/utils/authUser.js', () => ({ requireAdmin: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))

import { requireAdmin } from '../server/utils/authUser.js'
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('setResponseStatus', (e, s) => {
    e._status = s
  })
  vi.stubGlobal('getRouterParam', (e, k) => e._params?.[k])
}

const VALID_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const event = (params = {}) => ({ _params: params, _status: 200 })

/** Tracks every table/op touched, same shape as the stockist tests' helper. */
function makeTrackedSupabase(handlers = {}) {
  const calls = []
  function builder(table) {
    const state = { table, op: 'select', filters: [] }
    const finish = () => {
      calls.push({ table, op: state.op, filters: [...state.filters] })
      const res = handlers[table] ? handlers[table](state) : { data: null, error: null }
      return Promise.resolve(res)
    }
    const api = {
      select: () => api,
      delete: () => {
        state.op = 'delete'
        return api
      },
      eq: (k, v) => {
        state.filters.push([k, v])
        return api
      },
      maybeSingle: finish,
      then: (onFulfilled, onRejected) => finish().then(onFulfilled, onRejected)
    }
    return api
  }
  const storageRemove = vi.fn().mockResolvedValue({ error: null })
  return {
    from: builder,
    storage: { from: () => ({ remove: storageRemove }) },
    _calls: calls,
    _storageRemove: storageRemove
  }
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

async function loadHandler() {
  stubGlobals()
  return (await import('../server/api/admin/fabrics/[id].delete.js')).default
}

describe('DELETE /api/admin/fabrics/:id', () => {
  it('non-admin cannot delete a fabric — zero Supabase calls', async () => {
    requireAdmin.mockRejectedValue(Object.assign(new Error('Admin access required'), { statusCode: 403 }))
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler()

    await expect(handler(event({ id: VALID_ID }))).rejects.toThrow('Admin access required')
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('unknown fabric -> 404, nothing touched', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = makeTrackedSupabase({ fabrics: () => ({ data: null, error: null }) })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const ev = event({ id: VALID_ID })
    const res = await handler(ev)

    expect(ev._status).toBe(404)
    expect(res.error).toBeTruthy()
    expect(supabase._calls.some((c) => c.op === 'delete')).toBe(false)
  })

  it('product_fabrics cleanup fails -> the fabric row is NEVER deleted (error surfaced, item left in place)', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = makeTrackedSupabase({
      fabrics: (state) => (state.op === 'select' ? { data: { id: VALID_ID, image_url: null }, error: null } : { data: null, error: null }),
      product_fabrics: () => ({ data: null, error: { message: 'boom' } })
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const ev = event({ id: VALID_ID })
    const res = await handler(ev)

    expect(ev._status).toBe(500)
    expect(res.error).toBeTruthy()
    // the fabrics table must never see a delete op after product_fabrics cleanup failed
    expect(supabase._calls.some((c) => c.table === 'fabrics' && c.op === 'delete')).toBe(false)
  })

  it('product_fabrics is cleaned up BEFORE the fabric row is deleted (ordering), and the Storage image is removed after', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const imageUrl = 'https://project.supabase.co/storage/v1/object/public/fabric-images/some-file.jpg'
    const supabase = makeTrackedSupabase({
      fabrics: (state) => (state.op === 'select' ? { data: { id: VALID_ID, image_url: imageUrl }, error: null } : { error: null }),
      product_fabrics: () => ({ error: null })
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ id: VALID_ID }))

    expect(res).toEqual({ ok: true, id: VALID_ID })
    const opsInOrder = supabase._calls.filter((c) => c.op === 'delete' || (c.table === 'fabrics' && c.op === 'select'))
    const linkDeleteIdx = opsInOrder.findIndex((c) => c.table === 'product_fabrics' && c.op === 'delete')
    const fabricDeleteIdx = opsInOrder.findIndex((c) => c.table === 'fabrics' && c.op === 'delete')
    expect(linkDeleteIdx).toBeGreaterThanOrEqual(0)
    expect(fabricDeleteIdx).toBeGreaterThan(linkDeleteIdx)
    expect(supabase._storageRemove).toHaveBeenCalledWith(['some-file.jpg'])
  })

  it('fabric row delete fails -> 500, error surfaced, Storage image is never touched', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = makeTrackedSupabase({
      fabrics: (state) => (state.op === 'select' ? { data: { id: VALID_ID, image_url: 'https://x/fabric-images/f.jpg' }, error: null } : { error: { message: 'db down' } }),
      product_fabrics: () => ({ error: null })
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const ev = event({ id: VALID_ID })
    const res = await handler(ev)

    expect(ev._status).toBe(500)
    expect(res.error).toBeTruthy()
    expect(supabase._storageRemove).not.toHaveBeenCalled()
  })

  it('a fabric with no image (image_url null) deletes cleanly with zero Storage calls', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = makeTrackedSupabase({
      fabrics: (state) => (state.op === 'select' ? { data: { id: VALID_ID, image_url: null }, error: null } : { error: null }),
      product_fabrics: () => ({ error: null })
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ id: VALID_ID }))
    expect(res).toEqual({ ok: true, id: VALID_ID })
    expect(supabase._storageRemove).not.toHaveBeenCalled()
  })
})
