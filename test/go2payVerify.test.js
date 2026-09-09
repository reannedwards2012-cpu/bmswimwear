import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFakeSupabase } from './helpers/fakeSupabase.js'

vi.mock('../server/utils/go2pay.js', () => ({ getOrder: vi.fn() }))
import { getOrder } from '../server/utils/go2pay.js'
import { verifyAndMarkPaid } from '../server/utils/go2payVerify.js'

const CREATED = '2026-09-09T12:00:00.000Z'

function order(over = {}) {
  return {
    id: 'o1',
    status: 'pending',
    email: 'reann@example.com',
    subtotal_usd_cents: 12000,
    total_usd_cents: 13481, // subtotal + USA 1lb shipping
    go2pay_order_id: null,
    go2pay_request_id: 5353,
    created_at: CREATED,
    ...over
  }
}

// A Go2Pay order that passes every check for `expectedCents`.
function g2pOrder(expectedCents, over = {}) {
  return {
    ok: true,
    status: 200,
    data: {
      status: 'PAID',
      currency: 'USD',
      subtotal: expectedCents / 100,
      payment_id: 'pay_123',
      product_id: 5353,
      paid_at: '2026-09-09T12:05:00.000Z',
      ...over
    }
  }
}

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => {
  vi.restoreAllMocks()
  getOrder.mockReset()
})

describe('verifyAndMarkPaid — amount is checked against total_usd_cents', () => {
  it('marks paid when Go2Pay amount === total_usd_cents (subtotal + shipping)', async () => {
    getOrder.mockResolvedValue(g2pOrder(13481))
    const sb = createFakeSupabase([{ data: { id: 'o1' }, error: null }])

    const r = await verifyAndMarkPaid(sb, order(), 28518)
    expect(r.outcome).toBe('marked-paid')
    expect(r.marked).toBe(true)
  })

  it('rejects when Go2Pay was only charged the product subtotal (shipping missing)', async () => {
    getOrder.mockResolvedValue(g2pOrder(12000)) // == subtotal, != total
    const sb = createFakeSupabase([])

    const r = await verifyAndMarkPaid(sb, order(), 28518)
    expect(r.outcome).toBe('verification-failed')
    expect(r.failedChecks).toContain('amount')
  })

  it('falls back to subtotal_usd_cents for a pre-shipping historical order (total NULL)', async () => {
    getOrder.mockResolvedValue(g2pOrder(12000))
    const sb = createFakeSupabase([{ data: { id: 'o1' }, error: null }])

    const r = await verifyAndMarkPaid(sb, order({ total_usd_cents: null }), 28518)
    expect(r.outcome).toBe('marked-paid')
  })
})

describe('verifyAndMarkPaid — existing checks are unchanged', () => {
  it('rejects a non-USD Go2Pay order', async () => {
    getOrder.mockResolvedValue(g2pOrder(13481, { currency: 'XCD' }))
    const r = await verifyAndMarkPaid(createFakeSupabase([]), order(), 28518)
    expect(r.outcome).toBe('verification-failed')
    expect(r.failedChecks).toContain('currency')
  })

  it('rejects when the Go2Pay product_id does not match our go2pay_request_id (fail closed)', async () => {
    getOrder.mockResolvedValue(g2pOrder(13481, { product_id: 9999 }))
    const r = await verifyAndMarkPaid(createFakeSupabase([]), order(), 28518)
    expect(r.outcome).toBe('verification-failed')
    expect(r.failedChecks).toContain('requestLink')
  })

  it('rejects when payment_id is absent', async () => {
    getOrder.mockResolvedValue(g2pOrder(13481, { payment_id: '' }))
    const r = await verifyAndMarkPaid(createFakeSupabase([]), order(), 28518)
    expect(r.outcome).toBe('verification-failed')
    expect(r.failedChecks).toContain('paymentId')
  })

  it('is idempotent for an already-paid order', async () => {
    const r = await verifyAndMarkPaid(createFakeSupabase([]), order({ status: 'paid' }), 28518)
    expect(r.outcome).toBe('already-paid')
    expect(getOrder).not.toHaveBeenCalled()
  })

  it('rejects a callback bound to a different Go2Pay order id', async () => {
    const r = await verifyAndMarkPaid(createFakeSupabase([]), order({ go2pay_order_id: '111' }), 222)
    expect(r.outcome).toBe('bound-to-different-go2pay-order')
    expect(getOrder).not.toHaveBeenCalled()
  })

  it('surfaces a failed authoritative fetch', async () => {
    getOrder.mockResolvedValue({ ok: false, status: 502, data: null })
    const r = await verifyAndMarkPaid(createFakeSupabase([]), order(), 28518)
    expect(r.outcome).toBe('get-orders-failed')
  })
})
