import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('../server/utils/go2pay.js', () => ({ getOrder: vi.fn() }))

import { getOrder } from '../server/utils/go2pay.js'
import { verifyAndConfirmBikiniMixBooking } from '../server/utils/bikiniMixPayments.js'

function booking(overrides = {}) {
  return {
    id: 'bkg-1',
    status: 'pending_payment',
    paid_at: null,
    email: 'guest@example.com',
    charged_usd_cents: 5926,
    go2pay_order_id: null,
    go2pay_request_id: 'req-1',
    created_at: '2026-10-19T00:00:00Z',
    ...overrides
  }
}

function go2payOrder(overrides = {}) {
  return {
    status: 'PAID',
    currency: 'USD',
    subtotal: 59.26,
    payment_id: 'pay_123',
    product_id: 'req-1',
    email: 'guest@example.com',
    created: '2026-10-19T00:05:00Z',
    ...overrides
  }
}

function fakeSupabase(rpcResult) {
  return { rpc: vi.fn().mockResolvedValue(rpcResult) }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('verifyAndConfirmBikiniMixBooking', () => {
  it('idempotent no-op when already paid', async () => {
    const supabase = fakeSupabase({ data: null, error: null })
    const r = await verifyAndConfirmBikiniMixBooking(supabase, booking({ paid_at: '2026-10-19T01:00:00Z', status: 'confirmed' }), 'go-1')
    expect(r.outcome).toBe('already-paid')
    expect(r.verified).toBe(true)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('rejects a callback bound to a different Go2Pay order', async () => {
    const supabase = fakeSupabase({ data: null, error: null })
    const r = await verifyAndConfirmBikiniMixBooking(supabase, booking({ go2pay_order_id: 'go-OLD' }), 'go-NEW')
    expect(r.outcome).toBe('bound-to-different-go2pay-order')
    expect(r.verified).toBe(false)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('reports get-orders-failed when the Go2Pay lookup fails', async () => {
    getOrder.mockResolvedValue({ ok: false, status: 502, data: null })
    const supabase = fakeSupabase({ data: null, error: null })
    const r = await verifyAndConfirmBikiniMixBooking(supabase, booking(), 'go-1')
    expect(r.outcome).toBe('get-orders-failed')
    expect(r.verified).toBe(false)
  })

  it('rejects on amount mismatch without confirming', async () => {
    getOrder.mockResolvedValue({ ok: true, status: 200, data: go2payOrder({ subtotal: 1.0 }) })
    const supabase = fakeSupabase({ data: null, error: null })
    const r = await verifyAndConfirmBikiniMixBooking(supabase, booking(), 'go-1')
    expect(r.outcome).toBe('verification-failed')
    expect(r.failedChecks).toContain('amount')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('rejects on currency mismatch', async () => {
    getOrder.mockResolvedValue({ ok: true, status: 200, data: go2payOrder({ currency: 'XCD' }) })
    const supabase = fakeSupabase({ data: null, error: null })
    const r = await verifyAndConfirmBikiniMixBooking(supabase, booking(), 'go-1')
    expect(r.outcome).toBe('verification-failed')
    expect(r.failedChecks).toContain('currency')
  })

  it('rejects when the Go2Pay order is not linked to our request id', async () => {
    getOrder.mockResolvedValue({ ok: true, status: 200, data: go2payOrder({ product_id: 'some-other-request' }) })
    const supabase = fakeSupabase({ data: null, error: null })
    const r = await verifyAndConfirmBikiniMixBooking(supabase, booking(), 'go-1')
    expect(r.outcome).toBe('verification-failed')
    expect(r.failedChecks).toContain('requestLink')
  })

  it('rejects when status is not PAID', async () => {
    getOrder.mockResolvedValue({ ok: true, status: 200, data: go2payOrder({ status: 'PENDING' }) })
    const supabase = fakeSupabase({ data: null, error: null })
    const r = await verifyAndConfirmBikiniMixBooking(supabase, booking(), 'go-1')
    expect(r.outcome).toBe('verification-failed')
    expect(r.failedChecks).toContain('status')
  })

  it('confirms via the RPC when all checks pass and capacity allows', async () => {
    getOrder.mockResolvedValue({ ok: true, status: 200, data: go2payOrder() })
    const supabase = fakeSupabase({ data: { status: 'confirmed' }, error: null })
    const r = await verifyAndConfirmBikiniMixBooking(supabase, booking(), 'go-1')
    expect(r.outcome).toBe('confirmed')
    expect(r.verified).toBe(true)
    expect(supabase.rpc).toHaveBeenCalledWith(
      'confirm_bikini_mix_booking_payment',
      expect.objectContaining({ p_booking_id: 'bkg-1', p_go2pay_order_id: 'go-1', p_payment_id: 'pay_123' })
    )
  })

  it('reports needs-review when the RPC resolves to paid_needs_review', async () => {
    getOrder.mockResolvedValue({ ok: true, status: 200, data: go2payOrder() })
    const supabase = fakeSupabase({ data: { status: 'paid_needs_review' }, error: null })
    const r = await verifyAndConfirmBikiniMixBooking(supabase, booking(), 'go-1')
    expect(r.outcome).toBe('needs-review')
  })

  it('reports confirm-rpc-failed without crashing when the RPC errors', async () => {
    getOrder.mockResolvedValue({ ok: true, status: 200, data: go2payOrder() })
    const supabase = fakeSupabase({ data: null, error: { message: 'db exploded' } })
    const r = await verifyAndConfirmBikiniMixBooking(supabase, booking(), 'go-1')
    expect(r.outcome).toBe('confirm-rpc-failed')
    expect(r.verified).toBe(true)
  })
})
