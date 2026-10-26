import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Endpoint-level coverage for the Custom Quote Calculator admin API — same
 * stubbed-globals approach as test/fabricDelete.test.js /
 * test/stockistEndpoints.test.js. Focus: admin gating, input validation,
 * and the "server never trusts a client-submitted price" guarantee (the
 * calculation is always recomputed server-side from validated inputs, and
 * a fabric linked by id has its recorded cost override whatever the client
 * sent). Pure pricing-formula correctness is covered separately in
 * test/quoteCalculator.test.js.
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
  vi.stubGlobal('getQuery', (e) => e._query || {})
  vi.stubGlobal('readBody', async (e) => e._body)
}

const VALID_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const event = ({ params = {}, query = {}, body = null } = {}) => ({
  _params: params,
  _query: query,
  _body: body,
  _status: 200
})

/** Generic tracked Supabase double: records every table/op/filter touched. */
function makeTrackedSupabase(handlers = {}) {
  const calls = []
  function builder(table) {
    const state = { table, op: 'select', filters: [], payload: undefined, or: null }
    const finish = () => {
      calls.push({ table, op: state.op, filters: [...state.filters], payload: state.payload, or: state.or })
      const res = handlers[table] ? handlers[table](state) : { data: null, error: null }
      return Promise.resolve(res)
    }
    const api = {
      select: () => api,
      insert: (payload) => {
        state.op = 'insert'
        state.payload = payload
        return api
      },
      update: (payload) => {
        state.op = 'update'
        state.payload = payload
        return api
      },
      eq: (k, v) => {
        state.filters.push([k, v])
        return api
      },
      or: (clause) => {
        state.or = clause
        return api
      },
      order: () => api,
      single: finish,
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

async function loadHandler(path) {
  stubGlobals()
  return (await import(path)).default
}

const BASE_CALCULATOR_INPUT = {
  category: 'basic_bikini',
  productionHours: 2,
  labourRateXcdCents: 4000,
  fabricCostPerYardXcdCents: 7000,
  fabricYards: 0.5,
  packagingXcdCents: 500,
  consumablesXcdCents: 500,
  electricityMonthlyXcdCents: 5000,
  machineMaintenanceMonthlyXcdCents: 5000,
  expectedMonthlyVolume: 20,
  targetMarginPercent: 30,
  depositPercent: 50,
  categoryMinimumXcdCents: 18000
}

const BASE_QUOTE_BODY = {
  customerName: 'Jane Doe',
  category: 'basic_bikini',
  calculatorInput: BASE_CALCULATOR_INPUT
}

describe('POST /api/admin/quotes', () => {
  it('non-admin cannot create a quote — zero Supabase calls', async () => {
    requireAdmin.mockRejectedValue(Object.assign(new Error('Admin access required'), { statusCode: 403 }))
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler('../server/api/admin/quotes/index.post.js')

    await expect(handler(event({ body: BASE_QUOTE_BODY }))).rejects.toThrow('Admin access required')
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('missing customer name -> 400, nothing inserted', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = makeTrackedSupabase()
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler('../server/api/admin/quotes/index.post.js')

    const ev = event({ body: { ...BASE_QUOTE_BODY, customerName: '' } })
    const res = await handler(ev)

    expect(ev._status).toBe(400)
    expect(res.issues).toContain('Customer name is required.')
    expect(supabase._calls.some((c) => c.op === 'insert')).toBe(false)
  })

  it('recomputes the calculation server-side, ignoring any client-submitted price', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = makeTrackedSupabase({
      quotes: (state) => (state.op === 'insert' ? { data: { id: VALID_ID, quote_number: 1, ...state.payload }, error: null } : { data: null, error: null })
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler('../server/api/admin/quotes/index.post.js')

    // A client "spoofing" a huge price — the brief requires this never be trusted.
    const body = { ...BASE_QUOTE_BODY, finalPriceXcdCents: 999999 }
    const res = await handler(event({ body }))

    const insertCall = supabase._calls.find((c) => c.table === 'quotes' && c.op === 'insert')
    expect(insertCall.payload.final_price_xcd_cents).not.toBe(999999)
    // fabric 3500 + packaging 500 + consumables 500 + labour 8000 + overhead 500 = 13000; /0.7 -> rounds up to 19000
    expect(insertCall.payload.final_price_xcd_cents).toBe(19000)
    expect(insertCall.payload.calculation.outputs.estimatedCostXcdCents).toBe(13000)
    expect(res.quote).toBeDefined()
  })

  it('a linked fabric with a recorded unit cost OVERRIDES the client-submitted fabric rate', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const FABRIC_ID = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'
    const supabase = makeTrackedSupabase({
      fabrics: () => ({ data: { unit_cost_xcd_cents: 9000 }, error: null }),
      quotes: (state) => (state.op === 'insert' ? { data: { id: VALID_ID, quote_number: 2, ...state.payload }, error: null } : { data: null, error: null })
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler('../server/api/admin/quotes/index.post.js')

    const body = {
      ...BASE_QUOTE_BODY,
      calculatorInput: { ...BASE_CALCULATOR_INPUT, fabricId: FABRIC_ID, fabricCostPerYardXcdCents: 7000 }
    }
    await handler(event({ body }))

    const insertCall = supabase._calls.find((c) => c.table === 'quotes' && c.op === 'insert')
    // fabric cost should be 9000 * 0.5 = 4500, not 7000 * 0.5 = 3500
    expect(insertCall.payload.calculation.outputs.fabricCostXcdCents).toBe(4500)
  })
})

describe('PATCH /api/admin/quotes/:id', () => {
  it('no fields provided -> 400, no update sent', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = makeTrackedSupabase()
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler('../server/api/admin/quotes/[id].patch.js')

    const ev = event({ params: { id: VALID_ID }, body: {} })
    const res = await handler(ev)

    expect(ev._status).toBe(400)
    expect(res.error).toBeTruthy()
    expect(supabase._calls.some((c) => c.op === 'update')).toBe(false)
  })

  it('a status-only change leaves `calculation` and `final_price_xcd_cents` untouched', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = makeTrackedSupabase({
      quotes: (state) => (state.op === 'update' ? { data: { id: VALID_ID, quote_number: 1, ...state.payload }, error: null } : { data: null, error: null })
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler('../server/api/admin/quotes/[id].patch.js')

    const ev = event({ params: { id: VALID_ID }, body: { status: 'sent' } })
    await handler(ev)

    const updateCall = supabase._calls.find((c) => c.table === 'quotes' && c.op === 'update')
    expect(updateCall.payload.status).toBe('sent')
    expect(updateCall.payload.calculation).toBeUndefined()
    expect(updateCall.payload.final_price_xcd_cents).toBeUndefined()
  })

  it('sending a new calculatorInput recomputes and overwrites calculation + final price', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = makeTrackedSupabase({
      quotes: (state) => (state.op === 'update' ? { data: { id: VALID_ID, quote_number: 1, ...state.payload }, error: null } : { data: null, error: null })
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler('../server/api/admin/quotes/[id].patch.js')

    const ev = event({
      params: { id: VALID_ID },
      body: { calculatorInput: { ...BASE_CALCULATOR_INPUT, finalPriceOverrideXcdCents: 25000 } }
    })
    const res = await handler(ev)

    const updateCall = supabase._calls.find((c) => c.table === 'quotes' && c.op === 'update')
    expect(updateCall.payload.final_price_xcd_cents).toBe(25000)
    expect(res.quote).toBeDefined()
  })

  it('invalid id -> 400, zero Supabase calls', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = makeTrackedSupabase()
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler('../server/api/admin/quotes/[id].patch.js')

    const ev = event({ params: { id: 'not-a-uuid' }, body: { status: 'sent' } })
    const res = await handler(ev)

    expect(ev._status).toBe(400)
    expect(res.error).toBeTruthy()
    expect(supabase._calls.length).toBe(0)
  })
})

describe('GET /api/admin/quotes', () => {
  it('rejects an unknown status filter without querying Supabase', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })
    const handler = await loadHandler('../server/api/admin/quotes/index.get.js')

    const ev = event({ query: { status: 'not-a-real-status' } })
    const res = await handler(ev)

    expect(ev._status).toBe(400)
    expect(res.error).toBeTruthy()
    expect(fromSpy).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/quotes/:id/duplicate', () => {
  it('unknown quote -> 404, nothing inserted', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = makeTrackedSupabase({ quotes: () => ({ data: null, error: null }) })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler('../server/api/admin/quotes/[id]/duplicate.post.js')

    const ev = event({ params: { id: VALID_ID } })
    const res = await handler(ev)

    expect(ev._status).toBe(404)
    expect(res.error).toBeTruthy()
    expect(supabase._calls.some((c) => c.op === 'insert')).toBe(false)
  })

  it('duplicates a quote with status reset to draft and notes cleared', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const source = {
      customer_name: 'Jane Doe',
      customer_email: 'jane@example.com',
      customer_phone: null,
      description: 'Blue triangle bikini',
      category: 'basic_bikini',
      inspiration_image_urls: [],
      calculation: { inputs: {}, outputs: { finalPriceXcdCents: 19000 } },
      final_price_xcd_cents: 19000
    }
    const supabase = makeTrackedSupabase({
      quotes: (state) =>
        state.op === 'insert'
          ? { data: { id: 'new-id', quote_number: 2, ...state.payload }, error: null }
          : { data: source, error: null }
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler('../server/api/admin/quotes/[id]/duplicate.post.js')

    const ev = event({ params: { id: VALID_ID } })
    const res = await handler(ev)

    const insertCall = supabase._calls.find((c) => c.table === 'quotes' && c.op === 'insert')
    expect(insertCall.payload.status).toBe('draft')
    expect(insertCall.payload.admin_notes).toBeNull()
    expect(insertCall.payload.customer_notes).toBeNull()
    expect(insertCall.payload.final_price_xcd_cents).toBe(19000)
    expect(ev._status).toBe(201)
    expect(res.quote).toBeDefined()
  })
})
