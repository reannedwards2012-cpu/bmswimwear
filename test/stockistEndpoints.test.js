import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Endpoint-level coverage for the Stockists admin API — same stubbed-globals
 * approach as test/newsletterEndpoint.test.js / test/checkoutQuote.test.js.
 * Focused on the two things that matter most at this layer and are NOT
 * already covered by the pure-function tests in test/stockistInventory.test.js
 * and test/stockistValidation.test.js:
 *   1. Every mutating route re-verifies admin auth via requireAdmin() BEFORE
 *      touching Supabase at all — a rejected requireAdmin() must short-circuit
 *      with zero writes.
 *   2. POST .../movements correctly turns the record_stockist_movement() RPC's
 *      error responses (which is where "insufficient remaining stock" is
 *      actually enforced, under a row lock — see server/utils/stockistInventory.js's
 *      header comment) into the right HTTP status/message, and maps a
 *      successful RPC result through the same mappers used elsewhere.
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
}

const event = (body, params = {}) => ({ _body: body, _params: params, _status: 200 })

/**
 * A tracked fake Supabase client for tests that need to assert WHICH tables/
 * operations were touched (not just the final response) — e.g. proving a
 * failed RPC left no row behind, or that an archive PATCH never reaches the
 * inventory tables. `handlers[table]` is `(state) => ({data, error})`,
 * called once per finished chain (`.maybeSingle()`/`.single()`/awaited
 * directly); default is `{ data: null, error: null }` for any table without
 * a handler. `state` carries `{ op, payload, filters }` for the finished call.
 */
function makeTrackedSupabase(handlers = {}, { rpc } = {}) {
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
      delete: (opts) => {
        state.op = 'delete'
        state.payload = opts
        return api
      },
      eq: (k, v) => {
        state.filters.push([k, v])
        return api
      },
      order: () => api,
      maybeSingle: finish,
      single: finish,
      then: (onFulfilled, onRejected) => finish().then(onFulfilled, onRejected)
    }
    return api
  }
  return { from: builder, rpc: rpc ?? vi.fn(), _calls: calls }
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('POST /api/admin/stockists — non-admin cannot mutate', () => {
  it('a rejected requireAdmin() short-circuits before any Supabase call', async () => {
    stubGlobals()
    requireAdmin.mockRejectedValue(Object.assign(new Error('Admin access required'), { statusCode: 403 }))
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy })

    const handler = (await import('../server/api/admin/stockists/index.post.js')).default
    await expect(handler(event({ name: 'The Closet' }))).rejects.toThrow('Admin access required')
    expect(fromSpy).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/stockists/:id/items/:itemId/movements', () => {
  async function loadHandler() {
    stubGlobals()
    return (await import('../server/api/admin/stockists/[id]/items/[itemId]/movements.post.js')).default
  }

  it('non-admin cannot record a movement — zero RPC calls', async () => {
    requireAdmin.mockRejectedValue(Object.assign(new Error('Admin access required'), { statusCode: 403 }))
    const rpcSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ rpc: rpcSpy })
    const handler = await loadHandler()

    await expect(
      handler(event({ type: 'sold', quantity: 1, occurredOn: '2026-09-01', saleUnitPriceCents: 18000, saleCommissionBps: 1500 }, { itemId: 'item-1' }))
    ).rejects.toThrow('Admin access required')
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it('invalid input (missing quantity) never reaches the RPC', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const rpcSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ rpc: rpcSpy })
    const handler = await loadHandler()

    const ev = event({ type: 'restock', occurredOn: '2026-09-01' }, { itemId: 'item-1' })
    const res = await handler(ev)
    expect(ev._status).toBe(400)
    expect(res.error).toBeTruthy()
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it('"insufficient remaining stock" from the RPC -> 400 with a friendly message', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    supabaseAdmin.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'insufficient remaining stock: 0 left, 1 requested' } })
    })
    const handler = await loadHandler()

    const ev = event({ type: 'sold', quantity: 1, occurredOn: '2026-09-01', saleUnitPriceCents: 18000, saleCommissionBps: 1500 }, { itemId: 'item-1' })
    const res = await handler(ev)
    expect(ev._status).toBe(400)
    expect(res.error).toMatch(/not enough/i)
  })

  it('item not found -> 404', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    supabaseAdmin.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'inventory item ghost not found' } })
    })
    const handler = await loadHandler()

    const ev = event({ type: 'restock', quantity: 1, occurredOn: '2026-09-01' }, { itemId: 'ghost' })
    const res = await handler(ev)
    expect(ev._status).toBe(404)
    expect(res.error).toBeTruthy()
  })

  it('successful RESTOCK maps the RPC\'s {movement, item} jsonb result through the mappers', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const rpcResult = {
      movement: {
        id: 'mv-1',
        stockist_id: 'stk-1',
        item_id: 'item-1',
        movement_type: 'restock',
        quantity: 2,
        occurred_on: '2026-09-01',
        note: null,
        sale_unit_price_cents: null,
        sale_commission_bps: null,
        created_by: 'admin-1',
        created_at: '2026-09-01T00:00:00Z'
      },
      item: {
        id: 'item-1',
        stockist_id: 'stk-1',
        source: 'manual',
        product_id: null,
        product_name_snapshot: 'Sunset Sarong',
        product_image_snapshot: null,
        reference_code: null,
        colour: 'Coral',
        size: 'One Size',
        coverage: null,
        retail_price_cents: 9500,
        currency: 'XCD',
        default_commission_bps: 1000,
        notes: null,
        remaining_quantity: 5,
        total_supplied_quantity: 5,
        total_sold_quantity: 0,
        total_returned_quantity: 0,
        total_removed_quantity: 0,
        first_sent_at: '2026-08-01',
        is_archived: false,
        created_at: '2026-08-01T00:00:00Z'
      }
    }
    supabaseAdmin.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: rpcResult, error: null }) })
    const handler = await loadHandler()

    const ev = event({ type: 'restock', quantity: 2, occurredOn: '2026-09-01' }, { itemId: 'item-1' })
    const res = await handler(ev)

    expect(ev._status).toBe(201)
    expect(res.item).toMatchObject({ id: 'item-1', remainingQuantity: 5, totalSuppliedQuantity: 5 })
    expect(res.movement).toMatchObject({ id: 'mv-1', type: 'restock', quantity: 2 })
  })
})

describe('inactive stockist historical records remain readable', () => {
  it('GET /api/admin/stockists/:id never filters by is_active', async () => {
    stubGlobals()
    requireAdmin.mockResolvedValue({ id: 'admin-1' })

    const calls = []
    function builder(table) {
      const state = { table, filters: [] }
      const api = {
        select: () => api,
        eq: (k, v) => {
          state.filters.push([k, v])
          return api
        },
        order: () => api,
        maybeSingle: () => {
          calls.push({ table, filters: state.filters })
          if (table === 'stockists') {
            return Promise.resolve({
              data: { id: 'stk-1', name: 'The Closet', location: null, contact_name: null, phone: null, email: null, default_commission_bps: null, notes: null, is_active: false, created_at: '2026-01-01' },
              error: null
            })
          }
          return Promise.resolve({ data: null, error: null })
        },
        then: (onFulfilled) => {
          calls.push({ table, filters: state.filters })
          return Promise.resolve({ data: [], error: null }).then(onFulfilled)
        }
      }
      return api
    }
    supabaseAdmin.mockReturnValue({ from: builder })

    const handler = (await import('../server/api/admin/stockists/[id].get.js')).default
    const res = await handler(event(null, { id: 'stk-1' }))

    expect(res.stockist).toMatchObject({ id: 'stk-1', isActive: false })
    const stockistCall = calls.find((c) => c.table === 'stockists')
    expect(stockistCall.filters.some(([k]) => k === 'is_active')).toBe(false)
  })
})

// ── atomic inventory item creation ──────────────────────────────────────
const FAKE_MOVEMENT_ROW = {
  id: 'mv-1',
  stockist_id: 'stk-1',
  item_id: 'item-1',
  movement_type: 'sent',
  quantity: 3,
  occurred_on: '2026-09-01',
  note: null,
  sale_unit_price_cents: null,
  sale_commission_bps: null,
  created_by: 'admin-1',
  created_at: '2026-09-01T00:00:00Z'
}
function fakeItemRow(overrides = {}) {
  return {
    id: 'item-1',
    stockist_id: 'stk-1',
    source: 'manual',
    product_id: null,
    product_name_snapshot: 'Sunset Sarong',
    product_image_snapshot: null,
    reference_code: null,
    colour: 'Coral',
    size: 'One Size',
    coverage: null,
    retail_price_cents: 9500,
    currency: 'XCD',
    default_commission_bps: 1000,
    notes: null,
    remaining_quantity: 3,
    total_supplied_quantity: 3,
    total_sold_quantity: 0,
    total_returned_quantity: 0,
    total_removed_quantity: 0,
    first_sent_at: '2026-09-01',
    is_archived: false,
    created_at: '2026-09-01T00:00:00Z',
    ...overrides
  }
}

describe('POST /api/admin/stockists/:id/items — atomic creation (item + initial SENT in one call)', () => {
  async function loadHandler() {
    stubGlobals()
    return (await import('../server/api/admin/stockists/[id]/items.post.js')).default
  }

  it('manual item: creates via ONE call to create_stockist_inventory_item — never inserts into stockist_inventory_items directly', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const rpc = vi.fn().mockResolvedValue({ data: { movement: FAKE_MOVEMENT_ROW, item: fakeItemRow() }, error: null })
    const supabase = makeTrackedSupabase({ stockists: () => ({ data: { id: 'stk-1' }, error: null }) }, { rpc })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(
      event(
        {
          source: 'manual',
          productNameSnapshot: 'Sunset Sarong',
          colour: 'Coral',
          size: 'One Size',
          retailPriceCents: 9500,
          defaultCommissionBps: 1000,
          initialQuantity: 3,
          dateSent: '2026-09-01'
        },
        { id: 'stk-1' }
      )
    )

    expect(res.item).toMatchObject({ id: 'item-1', remainingQuantity: 3, totalSuppliedQuantity: 3 })
    expect(res.movement).toMatchObject({ type: 'sent', quantity: 3 })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][0]).toBe('create_stockist_inventory_item')
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_source: 'manual', p_initial_quantity: 3, p_date_sent: '2026-09-01' })
    // No direct write against stockist_inventory_items from application code —
    // insert AND initial movement both happen inside the RPC's own transaction.
    expect(supabase._calls.some((c) => c.table === 'stockist_inventory_items')).toBe(false)
  })

  it('website product item: resolves name/image from the LIVE product row, not the client, before calling the RPC once', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const rpc = vi.fn().mockResolvedValue({
      data: {
        movement: FAKE_MOVEMENT_ROW,
        item: fakeItemRow({ source: 'product', product_id: 'prod-1', product_name_snapshot: 'Mimosa One Piece', product_image_snapshot: '/img1.jpg' })
      },
      error: null
    })
    const supabase = makeTrackedSupabase(
      {
        stockists: () => ({ data: { id: 'stk-1' }, error: null }),
        products: () => ({
          data: { name: 'Mimosa One Piece', product_images: [{ image_url: '/img1.jpg', sort_order: 0, is_primary: true }] },
          error: null
        })
      },
      { rpc }
    )
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    await handler(
      event(
        {
          source: 'product',
          productId: 'prod-1',
          productNameSnapshot: 'whatever the client thinks the name is', // must be ignored
          colour: 'Black',
          size: 'M',
          coverage: 'Cheeky',
          retailPriceCents: 18000,
          defaultCommissionBps: 1500,
          initialQuantity: 3,
          dateSent: '2026-09-01'
        },
        { id: 'stk-1' }
      )
    )

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_product_name_snapshot: 'Mimosa One Piece',
      p_product_image_snapshot: '/img1.jpg'
    })
  })

  it('failed create_stockist_inventory_item leaves NOTHING behind — no insert/delete against stockist_inventory_items to clean up', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'quantity must be a positive whole number' } })
    const supabase = makeTrackedSupabase({ stockists: () => ({ data: { id: 'stk-1' }, error: null }) }, { rpc })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const ev = event(
      {
        source: 'manual',
        productNameSnapshot: 'Sunset Sarong',
        retailPriceCents: 9500,
        defaultCommissionBps: 1000,
        initialQuantity: 3,
        dateSent: '2026-09-01'
      },
      { id: 'stk-1' }
    )
    const res = await handler(ev)

    expect(ev._status).toBe(500)
    expect(res.error).toBeTruthy()
    // The old two-step "insert item, then insert movement, delete item by hand
    // if that fails" pattern would show an insert AND a delete here. There is
    // now exactly one call to Supabase for the write: the RPC.
    expect(supabase._calls.filter((c) => c.table === 'stockist_inventory_items')).toHaveLength(0)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('non-admin cannot create inventory — zero RPC calls, zero Supabase reads', async () => {
    requireAdmin.mockRejectedValue(Object.assign(new Error('Admin access required'), { statusCode: 403 }))
    const rpc = vi.fn()
    const fromSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: fromSpy, rpc })
    const handler = await loadHandler()

    await expect(
      handler(
        event(
          { source: 'manual', productNameSnapshot: 'X', retailPriceCents: 100, defaultCommissionBps: 0, initialQuantity: 1, dateSent: '2026-09-01' },
          { id: 'stk-1' }
        )
      )
    ).rejects.toThrow('Admin access required')
    expect(fromSpy).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
})

// ── DELETE stockist: archive-not-delete when there is history ────────────
describe('DELETE /api/admin/stockists/:id', () => {
  async function loadHandler() {
    stubGlobals()
    return (await import('../server/api/admin/stockists/[id].delete.js')).default
  }

  it('a stockist WITH inventory history -> 409, hard delete is never attempted', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = makeTrackedSupabase({
      stockist_inventory_items: () => ({ count: 2, error: null })
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const ev = event(null, { id: 'stk-1' })
    const res = await handler(ev)

    expect(ev._status).toBe(409)
    expect(res.error).toMatch(/inactive/i)
    expect(supabase._calls.some((c) => c.table === 'stockists' && c.op === 'delete')).toBe(false)
  })

  it('a stockist with ZERO inventory items can be hard-deleted', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = makeTrackedSupabase({
      stockist_inventory_items: () => ({ count: 0, error: null }),
      stockists: (state) => (state.op === 'delete' ? { count: 1, error: null } : { data: null, error: null })
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = await loadHandler()

    const res = await handler(event(null, { id: 'stk-1' }))
    expect(res).toEqual({ ok: true })
    expect(supabase._calls.some((c) => c.table === 'stockists' && c.op === 'delete')).toBe(true)
  })
})

// ── quantity authority: the item PATCH endpoint can never move stock ─────
describe('PATCH /api/admin/stockists/:id/items/:itemId — quantities are not writable here', () => {
  it('remainingQuantity/total*Quantity in the request body are silently dropped — never reach the DB update', async () => {
    stubGlobals()
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = makeTrackedSupabase({
      stockist_inventory_items: () => ({ data: fakeItemRow({ notes: 'updated note' }), error: null })
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/stockists/[id]/items/[itemId].patch.js')).default

    const ev = event(
      {
        notes: 'updated note',
        remainingQuantity: 999,
        totalSuppliedQuantity: 999,
        totalSoldQuantity: 999,
        totalReturnedQuantity: 999,
        totalRemovedQuantity: 999
      },
      { id: 'stk-1', itemId: 'item-1' }
    )
    const res = await handler(ev)

    expect(res.item).toBeTruthy()
    const updateCall = supabase._calls.find((c) => c.table === 'stockist_inventory_items' && c.op === 'update')
    expect(updateCall).toBeTruthy()
    const writtenKeys = Object.keys(updateCall.payload)
    expect(writtenKeys).toEqual(expect.arrayContaining(['notes', 'updated_at']))
    for (const forbidden of ['remaining_quantity', 'total_supplied_quantity', 'total_sold_quantity', 'total_returned_quantity', 'total_removed_quantity']) {
      expect(writtenKeys).not.toContain(forbidden)
    }
  })
})

// ── archiving a stockist touches ONLY the stockists row ───────────────────
describe('PATCH /api/admin/stockists/:id — archiving preserves history untouched', () => {
  it('isActive:false writes only to the stockists table — inventory/movements are never touched', async () => {
    stubGlobals()
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = makeTrackedSupabase({
      stockists: () => ({
        data: { id: 'stk-1', name: 'The Closet', location: null, contact_name: null, phone: null, email: null, default_commission_bps: null, notes: null, is_active: false, created_at: '2026-01-01' },
        error: null
      })
    })
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/stockists/[id].patch.js')).default

    const res = await handler(event({ isActive: false }, { id: 'stk-1' }))

    expect(res.stockist).toMatchObject({ id: 'stk-1', isActive: false })
    expect(supabase._calls.every((c) => c.table === 'stockists')).toBe(true)
    expect(supabase._calls.some((c) => c.table === 'stockist_inventory_items' || c.table === 'stockist_inventory_movements')).toBe(false)
  })
})
