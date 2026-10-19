/**
 * The single source of truth for "is this Go2Pay order a valid payment for
 * this Bikini Mixer booking — and if so, confirm it."
 *
 * Mirrors server/utils/go2payVerify.js's verification pattern exactly
 * (independent GET /orders/{id} lookup, status/currency/amount/request-link/
 * payment-id/timestamp checks) adapted to bikini_mix_bookings. The one real
 * difference: "mark paid" is never a raw UPDATE here — it always goes
 * through the confirm_bikini_mix_booking_payment() RPC, because that
 * function is where the capacity-aware confirmed-vs-paid_needs_review
 * decision lives (see the migration). This module never touches capacity
 * logic itself.
 *
 * Used by server/api/payments/go2pay-bikini-mix/[token].post.js. Read /
 * verify / confirm only — never creates a Go2Pay Payment Request.
 */
import { getOrder } from './go2pay.js'

const CLOCK_TOLERANCE_MS = 5 * 60 * 1000

const norm = (v) => (typeof v === 'string' ? v.trim() : '')
const upper = (v) => norm(v).toUpperCase()
const lower = (v) => norm(v).toLowerCase()
const toCents = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}

/**
 * @param supabase        server admin client
 * @param booking         bikini_mix_bookings row: { id, status, paid_at, email,
 *                        charged_usd_cents, go2pay_order_id, go2pay_request_id,
 *                        created_at }
 * @param go2payOrderId   the Go2Pay order id to verify against
 * @returns {{
 *   outcome: 'already-paid'|'bound-to-different-go2pay-order'|'get-orders-failed'
 *          |'verification-failed'|'confirm-rpc-failed'|'confirmed'|'needs-review',
 *   verified: boolean, bookingId: string, go2payOrderId: string,
 *   status?: string, checks?: object, failedChecks?: string[], emailMatch?: boolean,
 *   go2pay?: object, getOrderHttp?: number, boundOrderId?: any, supabaseError?: string
 * }}
 */
export async function verifyAndConfirmBikiniMixBooking(supabase, booking, go2payOrderId) {
  const base = { bookingId: booking.id, go2payOrderId: String(go2payOrderId) }

  // 1. Idempotent — payment already verified (status may be 'confirmed' or
  //    'paid_needs_review'; paid_at is the single authoritative marker).
  if (booking.paid_at) {
    return { ...base, outcome: 'already-paid', verified: true, status: booking.status }
  }

  // 2. Duplicate-order protection.
  if (booking.go2pay_order_id != null && String(booking.go2pay_order_id) !== String(go2payOrderId)) {
    return {
      ...base,
      outcome: 'bound-to-different-go2pay-order',
      verified: false,
      boundOrderId: booking.go2pay_order_id
    }
  }

  // 3. Authoritative fetch.
  const lookup = await getOrder(go2payOrderId)
  if (!lookup.ok || !lookup.data || typeof lookup.data !== 'object') {
    return { ...base, outcome: 'get-orders-failed', verified: false, getOrderHttp: lookup.status }
  }

  const g = lookup.data
  const gAmountCents = toCents(g.subtotal ?? g.price)
  const gPaymentId = norm(g.payment_id) || null
  const expectedAmountCents = booking.charged_usd_cents
  const gTimestamp = g.paid_at ?? g.created ?? g.created_at ?? null
  const gLinkId = g.product_id ?? null

  const emailMatch = !!lower(g.email) && lower(g.email) === lower(booking.email)

  const checks = {
    status: upper(g.status) === 'PAID',
    currency: upper(g.currency) === 'USD',
    amount: Number.isFinite(gAmountCents) && gAmountCents === expectedAmountCents,
    requestLink:
      gLinkId != null &&
      booking.go2pay_request_id != null &&
      String(gLinkId) === String(booking.go2pay_request_id),
    paymentId: !!gPaymentId
  }

  if (gTimestamp) {
    const ts = Date.parse(gTimestamp)
    const localTs = Date.parse(booking.created_at)
    checks.timestamp =
      !Number.isFinite(ts) || !Number.isFinite(localTs) ? true : ts >= localTs - CLOCK_TOLERANCE_MS
  }

  const failedChecks = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([k]) => k)

  const safeGo2pay = {
    status: upper(g.status) || null,
    currency: upper(g.currency) || null,
    amountMatches: checks.amount,
    hasPaymentId: !!gPaymentId,
    productId: gLinkId,
    orderKeys: Object.keys(g)
  }

  if (failedChecks.length > 0) {
    return {
      ...base,
      outcome: 'verification-failed',
      verified: false,
      checks,
      failedChecks,
      emailMatch,
      go2pay: safeGo2pay
    }
  }

  // 4. Confirm — atomic, capacity-aware, idempotent. Never a raw UPDATE.
  const { data: confirmed, error } = await supabase.rpc('confirm_bikini_mix_booking_payment', {
    p_booking_id: booking.id,
    p_go2pay_order_id: String(go2payOrderId),
    p_payment_id: gPaymentId
  })

  if (error || !confirmed) {
    return {
      ...base,
      outcome: 'confirm-rpc-failed',
      verified: true,
      checks,
      emailMatch,
      go2pay: safeGo2pay,
      supabaseError: error?.message
    }
  }

  return {
    ...base,
    outcome: confirmed.status === 'confirmed' ? 'confirmed' : 'needs-review',
    verified: true,
    status: confirmed.status,
    checks,
    emailMatch,
    go2pay: safeGo2pay
  }
}
