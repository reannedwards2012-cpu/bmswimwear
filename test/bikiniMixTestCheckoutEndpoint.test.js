import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Endpoint-level coverage for POST /api/admin/bikini-mix/test-checkout —
 * the admin-only test-booking flow (server/utils/bikiniMixTestMode.js).
 * Proves: admin gating (throws before touching Supabase), calls the TEST
 * RPC (never the real claim_bikini_mix_booking), charges the fixed
 * TEST_CHARGE_USD_CENTS rather than a price-derived amount, and labels the
 * Go2Pay request as a test. Same STATE1/2/3 state-machine coverage already
 * proven for the real endpoint is not re-duplicated here in full — only
 * what differs.
 */

vi.mock('../server/utils/authUser.js', () => ({ requireAdmin: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))
vi.mock('../server/utils/go2pay.js', () => ({
  createPaymentRequest: vi.fn(),
  getPaymentRequest: vi.fn()
}))
vi.mock('../server/utils/siteUrl.js', () => ({ siteUrl: () => 'https://bmswimwear.com' }))

import { requireAdmin } from '../server/utils/authUser.js'
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'
import { createPaymentRequest } from '../server/utils/go2pay.js'
import { TEST_CHARGE_USD_CENTS } from '../server/utils/bikiniMixTestMode.js'

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
  package: 'the_works',
  topSize: 'M',
  bottomSize: 'M',
  bottomStyle: 'tie-side',
  bottomCoverage: 'bikini',
  leftFabricId: FAB_LEFT,
  rightFabricId: FAB_RIGHT,
  bottomFabricId: FAB_BOTTOM,
  fullName: 'Admin Tester',
  email: 'admin@example.com',
  whatsapp: '+1 473 555 1234',
  personalizationName: 'Admin',
  marketingOptIn: false,
  termsAccepted: true
}

const EVENT_ROW = { classic_mix_price_xcd_cents: 16000, the_works_price_xcd_cents: 20000 }
const FABRIC_ROWS = [
  { id: FAB_LEFT, name: 'Sunset Coral', hex_color: '#E66B45', is_active: true, status: 'available' },
  { id: FAB_RIGHT, name: 'Sunset Coral', hex_color: '#E66B45', is_active: true, status: 'available' },
  { id: FAB_BOTTOM, name: 'Sunset Coral', hex_color: '#E66B45', is_active: true, status: 'available' }
]

function freshTestBookingRow(overrides = {}) {
  return {
    id: 'bkg-test-1',
    booking_number: 99,
    package: 'the_works',
    retail_price_xcd_cents: 20000,
    charged_usd_cents: null,
    go2pay_request_id: null,
    go2pay_payment_url: null,
    paid_at: null,
    email: 'admin@example.com',
    whatsapp: '+1 473 555 1234',
    payment_callback_token: 'cb-token-test',
    is_test: true,
    ...overrides
  }
}

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
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          then: (onFulfilled) => {
            const result = updateResults[updateCallIndex] ?? { data: [{ id: 'bkg-test-1' }], error: null }
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
  const mod = await import('../server/api/admin/bikini-mix/test-checkout.post.js')
  return mod.default
}

describe('POST /api/admin/bikini-mix/test-checkout', () => {
  it('requires admin before touching Supabase or validating the body', async () => {
    const handler = await loadHandler()
    requireAdmin.mockRejectedValue(Object.assign(new Error('unauthorized'), { statusCode: 401 }))
    const supabase = fakeSupabase({ rpcResult: { data: null, error: null } })
    supabaseAdmin.mockReturnValue(supabase)

    await expect(handler(event(VALID_BODY))).rejects.toThrow('unauthorized')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('calls claim_bikini_mix_booking_test, never the real claim RPC', async () => {
    const handler = await loadHandler()
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    createPaymentRequest.mockResolvedValue({ id: 'req-test', payment_url: 'https://go2pay.gd/pay/req-test' })
    const supabase = fakeSupabase({
      rpcResult: { data: freshTestBookingRow(), error: null },
      updateResults: [
        { data: [{ id: 'bkg-test-1' }], error: null },
        { data: [{ id: 'bkg-test-1' }], error: null }
      ]
    })
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event(VALID_BODY))

    expect(res.success).toBe(true)
    expect(res.isTest).toBe(true)
    expect(supabase.rpc).toHaveBeenCalledWith('claim_bikini_mix_booking_test', expect.any(Object))
  })

  it('charges the fixed TEST_CHARGE_USD_CENTS, not a price-derived amount', async () => {
    const handler = await loadHandler()
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    createPaymentRequest.mockResolvedValue({ id: 'req-test', payment_url: 'https://go2pay.gd/pay/req-test' })
    const supabase = fakeSupabase({
      rpcResult: { data: freshTestBookingRow(), error: null }, // retail_price_xcd_cents: 20000 (The Works)
      updateResults: [
        { data: [{ id: 'bkg-test-1' }], error: null },
        { data: [{ id: 'bkg-test-1' }], error: null }
      ]
    })
    supabaseAdmin.mockReturnValue(supabase)

    await handler(event(VALID_BODY))

    const sentAmount = createPaymentRequest.mock.calls[0][0].amount
    expect(sentAmount).toBeCloseTo(TEST_CHARGE_USD_CENTS / 100, 2) // $1.00 — NOT $74.07 (what The Works would derive to)
  })

  it('labels the Go2Pay request and description as a test', async () => {
    const handler = await loadHandler()
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    createPaymentRequest.mockResolvedValue({ id: 'req-test', payment_url: 'https://go2pay.gd/pay/req-test' })
    const supabase = fakeSupabase({
      rpcResult: { data: freshTestBookingRow(), error: null },
      updateResults: [
        { data: [{ id: 'bkg-test-1' }], error: null },
        { data: [{ id: 'bkg-test-1' }], error: null }
      ]
    })
    supabaseAdmin.mockReturnValue(supabase)

    await handler(event(VALID_BODY))

    const payload = createPaymentRequest.mock.calls[0][0]
    expect(payload.name).toMatch(/^\[TEST\]/)
    expect(payload.description).toMatch(/\[TEST\]/)
    expect(payload.success_url).toContain('test=1')
  })

  it('surfaces a fully-booked rejection the same way the real endpoint would', async () => {
    const handler = await loadHandler()
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = fakeSupabase({ rpcResult: { data: null, error: { code: '55000', message: 'event is fully booked' } } })
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event(VALID_BODY))

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/fully booked/i)
    expect(createPaymentRequest).not.toHaveBeenCalled()
  })

  it('short-circuits with alreadyPaid without calling Go2Pay', async () => {
    const handler = await loadHandler()
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = fakeSupabase({ rpcResult: { data: freshTestBookingRow({ paid_at: '2026-10-21T00:00:00Z' }), error: null } })
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event(VALID_BODY))

    expect(res.success).toBe(true)
    expect(res.alreadyPaid).toBe(true)
    expect(createPaymentRequest).not.toHaveBeenCalled()
  })
})
