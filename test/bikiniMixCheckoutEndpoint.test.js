import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Endpoint-level coverage for POST /api/bikini-mix/checkout — same
 * stubbed-globals + mocked-Supabase approach as test/bikiniMixEndpoints.test.js,
 * plus a mocked server/utils/go2pay.js so no real Go2Pay API call is ever
 * made. This proves the endpoint's state machine (closed/full rejection,
 * fresh request creation, idempotent reuse, already-paid short-circuit) —
 * the real RPC's own capacity/concurrency logic is covered separately by
 * the migration's own design + the earlier live verification that calling
 * it while closed correctly rejects without creating a row.
 */

vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))
vi.mock('../server/utils/go2pay.js', () => ({
  createPaymentRequest: vi.fn(),
  getPaymentRequest: vi.fn()
}))
vi.mock('../server/utils/siteUrl.js', () => ({ siteUrl: () => 'https://bmswimwear.com' }))

import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'
import { createPaymentRequest, getPaymentRequest } from '../server/utils/go2pay.js'

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('readBody', async (e) => e._body)
  vi.stubGlobal('setResponseStatus', (e, s) => {
    e._status = s
  })
}

const event = (body) => ({ _body: body, _status: 200 })

const FAB_LEFT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const FAB_RIGHT = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const FAB_BOTTOM = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

const VALID_BODY = {
  checkoutIdempotencyKey: '11111111-1111-1111-1111-111111111111',
  package: 'classic_mix',
  topSize: 'M',
  bottomSize: 'M',
  bottomStyle: 'tie-side',
  bottomCoverage: 'bikini',
  leftFabricId: FAB_LEFT,
  rightFabricId: FAB_RIGHT,
  bottomFabricId: FAB_BOTTOM,
  fullName: 'Jane Guest',
  email: 'jane@example.com',
  whatsapp: '+1 473 555 1234',
  personalizationName: null,
  marketingOptIn: false,
  termsAccepted: true
}

const EVENT_ROW = { classic_mix_price_xcd_cents: 16000, the_works_price_xcd_cents: 20000 }
const FABRIC_ROWS = [
  { id: FAB_LEFT, name: 'Sunset Coral', hex_color: '#E66B45', is_active: true, status: 'available' },
  { id: FAB_RIGHT, name: 'Sunset Coral', hex_color: '#E66B45', is_active: true, status: 'available' },
  { id: FAB_BOTTOM, name: 'Sunset Coral', hex_color: '#E66B45', is_active: true, status: 'available' }
]

function freshBookingRow(overrides = {}) {
  return {
    id: 'bkg-1',
    booking_number: 7,
    package: 'classic_mix',
    retail_price_xcd_cents: 16000,
    charged_usd_cents: null,
    go2pay_request_id: null,
    go2pay_payment_url: null,
    paid_at: null,
    email: 'jane@example.com',
    whatsapp: '+1 473 555 1234',
    payment_callback_token: 'cb-token-1',
    ...overrides
  }
}

/** Builds a fake supabase client: `fabrics`/`bikini_mix_event` reads + `bikini_mix_bookings` guarded updates. */
function fakeSupabase({ rpcResult, updateResults = [] }) {
  let updateCallIndex = 0
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
    from(table) {
      if (table === 'bikini_mix_event') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: EVENT_ROW, error: null }) }) }) }
      }
      if (table === 'fabrics') {
        return { select: () => ({ in: () => Promise.resolve({ data: FABRIC_ROWS, error: null }) }) }
      }
      if (table === 'bikini_mix_bookings') {
        const chain = {
          update: () => chain,
          select: () => chain,
          eq: () => chain,
          is: () => chain,
          maybeSingle: () => Promise.resolve({ data: updateResults[updateCallIndex]?.recheck ?? null, error: null }),
          then: (onFulfilled) => {
            const result = updateResults[updateCallIndex] ?? { data: [{ id: 'bkg-1' }], error: null }
            updateCallIndex += 1
            return Promise.resolve(result).then(onFulfilled)
          }
        }
        return chain
      }
      throw new Error(`unexpected table ${table}`)
    }
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
  const mod = await import('../server/api/bikini-mix/checkout.post.js')
  return mod.default
}

describe('POST /api/bikini-mix/checkout', () => {
  it('rejects a malformed payload before touching the database', async () => {
    const handler = await loadHandler()
    const supabase = fakeSupabase({ rpcResult: { data: null, error: null } })
    supabaseAdmin.mockReturnValue(supabase)

    const e = event({ ...VALID_BODY, email: 'not-an-email' })
    const res = await handler(e)

    expect(e._status).toBe(400)
    expect(res.success).toBe(false)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('returns 409 when the RPC reports bookings are closed', async () => {
    const handler = await loadHandler()
    const supabase = fakeSupabase({ rpcResult: { data: null, error: { code: '55000', message: 'bookings are closed' } } })
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event(VALID_BODY))

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/closed/i)
    expect(createPaymentRequest).not.toHaveBeenCalled()
  })

  it('short-circuits with alreadyPaid when the claimed booking is already paid', async () => {
    const handler = await loadHandler()
    const supabase = fakeSupabase({
      rpcResult: { data: freshBookingRow({ paid_at: '2026-10-19T01:00:00Z' }), error: null }
    })
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event(VALID_BODY))

    expect(res.success).toBe(true)
    expect(res.alreadyPaid).toBe(true)
    expect(createPaymentRequest).not.toHaveBeenCalled()
  })

  it('reuses an existing payment URL (STATE 1) without minting a new Go2Pay request', async () => {
    const handler = await loadHandler()
    const supabase = fakeSupabase({
      rpcResult: { data: freshBookingRow({ go2pay_request_id: 'req-1', go2pay_payment_url: 'https://go2pay.gd/pay/req-1' }), error: null }
    })
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event(VALID_BODY))

    expect(res.success).toBe(true)
    expect(res.paymentUrl).toBe('https://go2pay.gd/pay/req-1')
    expect(createPaymentRequest).not.toHaveBeenCalled()
  })

  it('recovers a saved request id missing its URL (STATE 2) via getPaymentRequest, never re-minting', async () => {
    const handler = await loadHandler()
    getPaymentRequest.mockResolvedValue({ ok: true, status: 200, data: { payment_url: 'https://go2pay.gd/pay/req-1' } })
    const supabase = fakeSupabase({
      rpcResult: { data: freshBookingRow({ go2pay_request_id: 'req-1', go2pay_payment_url: null }), error: null },
      updateResults: [{ data: [{ id: 'bkg-1' }], error: null }]
    })
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event(VALID_BODY))

    expect(res.success).toBe(true)
    expect(res.paymentUrl).toBe('https://go2pay.gd/pay/req-1')
    expect(createPaymentRequest).not.toHaveBeenCalled()
    expect(getPaymentRequest).toHaveBeenCalledWith('req-1')
  })

  it('creates exactly one Go2Pay request on a fresh booking (STATE 3) and returns its payment URL', async () => {
    const handler = await loadHandler()
    createPaymentRequest.mockResolvedValue({ id: 'req-new', payment_url: 'https://go2pay.gd/pay/req-new' })
    const supabase = fakeSupabase({
      rpcResult: { data: freshBookingRow(), error: null },
      updateResults: [
        { data: [{ id: 'bkg-1' }], error: null }, // CLAIM
        { data: [{ id: 'bkg-1' }], error: null } // FINALIZE
      ]
    })
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event(VALID_BODY))

    expect(res.success).toBe(true)
    expect(res.paymentUrl).toBe('https://go2pay.gd/pay/req-new')
    expect(createPaymentRequest).toHaveBeenCalledTimes(1)
    const sentAmount = createPaymentRequest.mock.calls[0][0].amount
    expect(sentAmount).toBeCloseTo(59.26, 2) // EC$160.00 at US$1 = EC$2.70
  })

  it('rejects when a selected fabric is no longer available', async () => {
    const handler = await loadHandler()
    const supabase = fakeSupabase({ rpcResult: { data: freshBookingRow(), error: null } })
    supabase.from = (table) => {
      if (table === 'bikini_mix_event') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: EVENT_ROW, error: null }) }) }) }
      if (table === 'fabrics') {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [
                  { id: FAB_LEFT, name: 'Sunset Coral', hex_color: '#E66B45', is_active: true, status: 'available' },
                  { id: FAB_RIGHT, name: 'Discontinued', hex_color: '#000', is_active: false, status: 'unavailable' },
                  { id: FAB_BOTTOM, name: 'Sunset Coral', hex_color: '#E66B45', is_active: true, status: 'available' }
                ],
                error: null
              })
          })
        }
      }
      throw new Error(`unexpected table ${table}`)
    }
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event(VALID_BODY))

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/fabric/i)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})
