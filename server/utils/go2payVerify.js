/**
 * The single source of truth for "is this Go2Pay order a valid payment for this
 * Bahama Mama order — and if so, mark it paid."
 *
 * Used by the live callback (server/api/payments/go2pay/[token].post.js). A
 * one-off reconcile endpoint also used it (removed after Order 28531).
 *
 * Read / verify / update only — never creates a Go2Pay Payment Request.
 * Returns a SAFE result object: order/provider IDs and booleans only — no
 * customer PII, no payment_id value, no tokens, no JWT, no payment URL.
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
 * @param supabase       server admin client
 * @param order          orders row: { id, status, email, subtotal_usd_cents,
 *                       go2pay_order_id, go2pay_request_id, created_at }
 * @param go2payOrderId  the Go2Pay order id to verify against
 * @returns {{
 *   outcome: 'already-paid'|'bound-to-different-go2pay-order'|'get-orders-failed'
 *          |'verification-failed'|'mark-paid-failed'|'unique-violation-already-final'
 *          |'marked-paid'|'no-longer-pending',
 *   verified: boolean, marked: boolean, orderId: string, go2payOrderId: string,
 *   checks?: object, failedChecks?: string[], emailMatch?: boolean,
 *   savedRequestId?: number|null, go2payOrderProductId?: any,
 *   go2pay?: object, getOrderHttp?: number, boundOrderId?: any, supabaseError?: string
 * }}
 */
export async function verifyAndMarkPaid(supabase, order, go2payOrderId) {
  const base = { orderId: order.id, go2payOrderId: String(go2payOrderId) }

  // 1. Idempotent — already finalised.
  if (order.status === 'paid') {
    return { ...base, outcome: 'already-paid', verified: true, marked: false }
  }

  // 2. Duplicate-order protection — never let a different Go2Pay order finalise this one.
  if (order.go2pay_order_id != null && String(order.go2pay_order_id) !== String(go2payOrderId)) {
    return {
      ...base,
      outcome: 'bound-to-different-go2pay-order',
      verified: false,
      marked: false,
      boundOrderId: order.go2pay_order_id
    }
  }

  // 3. Authoritative fetch.
  const lookup = await getOrder(go2payOrderId)
  if (!lookup.ok || !lookup.data || typeof lookup.data !== 'object') {
    return {
      ...base,
      outcome: 'get-orders-failed',
      verified: false,
      marked: false,
      getOrderHttp: lookup.status
    }
  }

  const g = lookup.data
  const gAmountCents = toCents(g.subtotal ?? g.price)
  const gPaymentId = norm(g.payment_id) || null
  const gTimestamp = g.paid_at ?? g.created ?? g.created_at ?? null
  const gLinkId = g.product_id ?? null

  // Diagnostic only — payer may use a different billing email on Go2Pay's page.
  const emailMatch = !!lower(g.email) && lower(g.email) === lower(order.email)

  const checks = {
    status: upper(g.status) === 'PAID',
    currency: upper(g.currency) === 'USD',
    amount: Number.isFinite(gAmountCents) && gAmountCents === order.subtotal_usd_cents,
    // Go2Pay stores our Payment Request id in the order's `product_id` field for
    // request-originated orders (order.request_id is ""). MANDATORY, fail closed.
    requestLink:
      gLinkId != null &&
      order.go2pay_request_id != null &&
      String(gLinkId) === String(order.go2pay_request_id),
    paymentId: !!gPaymentId
  }

  if (gTimestamp) {
    const ts = Date.parse(gTimestamp)
    const localTs = Date.parse(order.created_at)
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
      marked: false,
      checks,
      failedChecks,
      emailMatch,
      savedRequestId: order.go2pay_request_id ?? null,
      go2payOrderProductId: gLinkId,
      go2pay: safeGo2pay
    }
  }

  // 4. Mark paid — idempotent, first-write-wins on status.
  const updated = await supabase
    .from('orders')
    .update({
      status: 'paid',
      payment_provider: 'go2pay',
      go2pay_order_id: String(go2payOrderId),
      payment_id: gPaymentId,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', order.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (updated.error) {
    if (updated.error.code === '23505') {
      return { ...base, outcome: 'unique-violation-already-final', verified: true, marked: false }
    }
    return {
      ...base,
      outcome: 'mark-paid-failed',
      verified: true,
      marked: false,
      supabaseError: updated.error.message
    }
  }

  return {
    ...base,
    outcome: updated.data ? 'marked-paid' : 'no-longer-pending',
    verified: true,
    marked: !!updated.data,
    checks,
    emailMatch,
    savedRequestId: order.go2pay_request_id ?? null,
    go2payOrderProductId: gLinkId,
    go2pay: safeGo2pay
  }
}
