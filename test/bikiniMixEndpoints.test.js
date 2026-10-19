import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Endpoint-level coverage for the Bikini Mix admin API — same stubbed-
 * globals + mocked-Supabase approach as test/stockistEndpoints.test.js.
 *
 * The real Supabase migration (supabase/migrations/20261019000000_bikini_mix.sql)
 * has NOT been applied yet (explicitly not authorized to run it), so there
 * is no live database to test these endpoints against end-to-end this
 * round. These tests instead prove the endpoint LOGIC is correct — auth
 * gating, which columns get written, and the resolution state machine —
 * against a mocked Supabase client. A live pass is still needed once the
 * migration is applied; noted in the final report.
 */

vi.mock('../server/utils/authUser.js', () => ({ requireAdmin: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))

import { requireAdmin } from '../server/utils/authUser.js'
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('readBody', async (e) => e._body)
  vi.stubGlobal('setResponseStatus', (e, s) => {
    e._status = s
  })
  vi.stubGlobal('getRouterParam', (e, k) => e._params?.[k])
  vi.stubGlobal('getQuery', (e) => e._query ?? {})
}

const event = (body, params = {}, query = {}) => ({ _body: body, _params: params, _query: query, _status: 200 })

/** Tracked fake Supabase client — same shape as the Stockists test helper. */
function makeTrackedSupabase(handlers = {}) {
  const calls = []
  function builder(table) {
    const state = { table, op: 'select', payload: null, filters: [] }
    const finish = () => {
      calls.push({ table, op: state.op, payload: state.payload, filters: [...state.filters] })
      const res = handlers[table] ? handlers[table](state) : { data: null, error: null }
      return Promise.resolve(res)
    }
    const api = {
      select: () => api,
      update: (p) => {
        state.op = 'update'
        state.payload = p
        return api
      },
      upsert: (p, opts) => {
        state.op = 'upsert'
        state.payload = { ...p, __onConflict: opts?.onConflict }
        return api
      },
      eq: (k, v) => {
        state.filters.push([k, v])
        return api
      },
      order: () => api,
      maybeSingle: finish,
      then: (onFulfilled, onRejected) => finish().then(onFulfilled, onRejected)
    }
    return api
  }
  return { from: builder, _calls: calls }
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('PATCH /api/admin/bikini-mix/event', () => {
  async function loadHandler() {
    stubGlobals()
    return (await import('../server/api/admin/bikini-mix/event.patch.js')).default
  }

  it('non-admin cannot update event settings — zero Supabase calls', async () => {
    requireAdmin.mockRejectedValue(Object.assign(new Error('Admin access required'), { statusCode: 403 }))
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler()

    await expect(handler(event({ eventName: 'New Name' }))).rejects.toThrow('Admin access required')
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('writes exactly the provided fields to the correct columns', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = makeTrackedSupabase({
      bikini_mix_event: () => ({ data: { id: 'default', event_name: 'New Name', capacity: 20 }, error: null })
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ eventName: 'New Name', capacity: 20 }))
    expect(res.event).toBeTruthy()
    const call = supabase._calls.find((c) => c.table === 'bikini_mix_event' && c.op === 'update')
    expect(call.payload).toMatchObject({ event_name: 'New Name', capacity: 20 })
    expect(Object.keys(call.payload)).toEqual(expect.arrayContaining(['event_name', 'capacity', 'updated_at']))
  })

  it('rejects invalid input before ever calling Supabase', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler()

    const ev = event({ capacity: -1 })
    const res = await handler(ev)
    expect(ev._status).toBe(400)
    expect(res.error).toBeTruthy()
    expect(fromSpy).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/admin/bikini-mix/fabrics/:fabricId', () => {
  async function loadHandler() {
    stubGlobals()
    return (await import('../server/api/admin/bikini-mix/fabrics/[fabricId].patch.js')).default
  }
  const FABRIC_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  it('non-admin cannot toggle a fabric', async () => {
    requireAdmin.mockRejectedValue(Object.assign(new Error('Admin access required'), { statusCode: 403 }))
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler()

    await expect(handler(event({ isActive: true }, { fabricId: FABRIC_ID }))).rejects.toThrow('Admin access required')
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('upserts the join row on fabric_id, never touches the fabrics table itself', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = makeTrackedSupabase({
      fabrics: () => ({ data: { id: FABRIC_ID }, error: null }),
      bikini_mix_fabrics: () => ({ error: null })
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ isActive: true }, { fabricId: FABRIC_ID }))
    expect(res).toEqual({ fabricId: FABRIC_ID, isActive: true })

    const upsertCall = supabase._calls.find((c) => c.table === 'bikini_mix_fabrics' && c.op === 'upsert')
    expect(upsertCall.payload).toMatchObject({ fabric_id: FABRIC_ID, is_active: true, __onConflict: 'fabric_id' })
    expect(supabase._calls.some((c) => c.table === 'fabrics' && c.op === 'update')).toBe(false)
  })
})

describe('PATCH /api/admin/bikini-mix/bookings/:id — resolution state machine', () => {
  async function loadHandler() {
    stubGlobals()
    return (await import('../server/api/admin/bikini-mix/bookings/[id].patch.js')).default
  }
  const BOOKING_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  it('non-admin cannot resolve a booking', async () => {
    requireAdmin.mockRejectedValue(Object.assign(new Error('Admin access required'), { statusCode: 403 }))
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler()

    await expect(handler(event({ resolution: 'confirm' }, { id: BOOKING_ID }))).rejects.toThrow('Admin access required')
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('"confirm" is rejected when the booking is not paid_needs_review', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1', email: 'admin@test.com' })
    const supabase = makeTrackedSupabase({
      bikini_mix_bookings: (state) =>
        state.op === 'select' ? { data: { id: BOOKING_ID, status: 'pending_payment', admin_notes: null }, error: null } : { data: null, error: null }
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const ev = event({ resolution: 'confirm' }, { id: BOOKING_ID })
    const res = await handler(ev)
    expect(ev._status).toBe(409)
    expect(res.error).toMatch(/needs review/i)
    // never attempted an update
    expect(supabase._calls.some((c) => c.table === 'bikini_mix_bookings' && c.op === 'update')).toBe(false)
  })

  it('"confirm" succeeds from paid_needs_review and sets status to confirmed', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1', email: 'admin@test.com' })
    const supabase = makeTrackedSupabase({
      bikini_mix_bookings: (state) => {
        if (state.op === 'select') return { data: { id: BOOKING_ID, status: 'paid_needs_review', admin_notes: 'flagged' }, error: null }
        return { data: { id: BOOKING_ID, status: 'confirmed' }, error: null }
      }
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ resolution: 'confirm' }, { id: BOOKING_ID }))
    expect(res.booking).toBeTruthy()
    const updateCall = supabase._calls.find((c) => c.table === 'bikini_mix_bookings' && c.op === 'update')
    expect(updateCall.payload.status).toBe('confirmed')
    expect(updateCall.filters.some(([k, v]) => k === 'status' && v === 'paid_needs_review')).toBe(true)
  })

  it('"cancel" is rejected once a booking is already cancelled/expired-terminal', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1', email: 'admin@test.com' })
    const supabase = makeTrackedSupabase({
      bikini_mix_bookings: (state) =>
        state.op === 'select' ? { data: { id: BOOKING_ID, status: 'cancelled', admin_notes: null }, error: null } : { data: null, error: null }
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const ev = event({ resolution: 'cancel' }, { id: BOOKING_ID })
    const res = await handler(ev)
    expect(ev._status).toBe(409)
    expect(res.error).toBeTruthy()
  })

  it('"cancel" succeeds from confirmed', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1', email: 'admin@test.com' })
    const supabase = makeTrackedSupabase({
      bikini_mix_bookings: (state) => {
        if (state.op === 'select') return { data: { id: BOOKING_ID, status: 'confirmed', admin_notes: null }, error: null }
        return { data: { id: BOOKING_ID, status: 'cancelled' }, error: null }
      }
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event({ resolution: 'cancel', adminNotes: 'Customer requested' }, { id: BOOKING_ID }))
    expect(res.booking).toBeTruthy()
    const updateCall = supabase._calls.find((c) => c.table === 'bikini_mix_bookings' && c.op === 'update')
    expect(updateCall.payload.status).toBe('cancelled')
    expect(updateCall.payload.admin_notes).toMatch(/Customer requested/)
  })
})

describe('GET /api/admin/bikini-mix/production-summary', () => {
  async function loadHandler() {
    stubGlobals()
    return (await import('../server/api/admin/bikini-mix/production-summary.get.js')).default
  }

  it('non-admin cannot read the production summary', async () => {
    requireAdmin.mockRejectedValue(Object.assign(new Error('Admin access required'), { statusCode: 403 }))
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler()

    await expect(handler(event())).rejects.toThrow('Admin access required')
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('only queries status = confirmed and is_test = false, and groups distinct variants separately', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const rows = [
      { top_size: 'M', left_fabric_name_snapshot: 'Pink', right_fabric_name_snapshot: 'Pink', bottom_style: 'classic', bottom_coverage: 'bikini', bottom_size: 'L', bottom_fabric_name_snapshot: 'Pink' },
      { top_size: 'M', left_fabric_name_snapshot: 'Pink', right_fabric_name_snapshot: 'Pink', bottom_style: 'classic', bottom_coverage: 'bikini', bottom_size: 'L', bottom_fabric_name_snapshot: 'Pink' },
      { top_size: 'M', left_fabric_name_snapshot: 'Pink', right_fabric_name_snapshot: 'Pink', bottom_style: 'classic', bottom_coverage: 'bikini', bottom_size: 'L', bottom_fabric_name_snapshot: 'Pink' },
      { top_size: 'S', left_fabric_name_snapshot: 'Yellow', right_fabric_name_snapshot: 'Yellow', bottom_style: 'tie-side', bottom_coverage: 'cheeky', bottom_size: 'M', bottom_fabric_name_snapshot: 'Red' },
      { top_size: 'S', left_fabric_name_snapshot: 'Yellow', right_fabric_name_snapshot: 'Yellow', bottom_style: 'tie-side', bottom_coverage: 'cheeky', bottom_size: 'M', bottom_fabric_name_snapshot: 'Red' }
    ]
    const supabase = makeTrackedSupabase({ bikini_mix_bookings: () => ({ data: rows, error: null }) })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event())

    const call = supabase._calls.find((c) => c.table === 'bikini_mix_bookings')
    expect(call.filters).toEqual([
      ['status', 'confirmed'],
      ['is_test', false]
    ])

    expect(res.confirmedCount).toBe(5)
    expect(res.leftTriangles).toContainEqual({ colour: 'Pink', size: 'M', count: 3 })
    expect(res.leftTriangles).toContainEqual({ colour: 'Yellow', size: 'S', count: 2 })
    expect(res.bottoms).toContainEqual({ style: 'Classic', coverage: 'Bikini', size: 'L', colour: 'Pink', count: 3 })
    expect(res.bottoms).toContainEqual({ style: 'Tie-Side', coverage: 'Cheeky', size: 'M', colour: 'Red', count: 2 })
  })
})
