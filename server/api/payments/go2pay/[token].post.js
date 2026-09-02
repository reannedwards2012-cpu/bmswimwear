import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { getOrder } from '../../../utils/go2pay.js'

/**
 * POST /api/payments/go2pay/[token]
 *
 * Go2Pay payment callback. `token` is the order's server-generated
 * `payment_callback_token` (a per-order UUID never exposed to the browser) —
 * that is how the callback is matched to a Bahama Mama order.
 *
 * The callback body is a SIGNAL ONLY. An order is marked paid solely after an
 * independent GET /orders/{id} to Go2Pay (our vendor JWT) confirms:
 *   - the order exists under our account
 *   - status PAID
 *   - currency USD
 *   - authoritative amount === our server-calculated subtotal_usd_cents
 *   - customer email matches
 *   - (if present) provider timestamp not before our order creation
 * Processing is idempotent; a repeat callback for a paid order is a no-op.
 *
 * Go2Pay does not sign callbacks and exposes no documented Request→Order
 * identifier, so verification is correlation-based (accepted limitation).
 *
 * Responses to Go2Pay are minimal ({ received: bool }) — never order,
 * customer or database detail.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CLOCK_TOLERANCE_MS = 5 * 60 * 1000

const norm = (v) => (typeof v === 'string' ? v.trim() : '')
const upper = (v) => norm(v).toUpperCase()
const lower = (v) => norm(v).toLowerCase()
const toCents = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token || !UUID_RE.test(token)) {
    setResponseStatus(event, 404)
    return { received: false }
  }

  const body = await readBody(event).catch(() => null)
  const cbOrderId = body?.order_id
  const cbStatus = upper(body?.status)
  const cbCurrency = upper(body?.currency)
  const cbAmount = body?.subtotal ?? body?.price

  // Basic shape check — reject obviously malformed callbacks.
  if (
    (typeof cbOrderId !== 'number' && typeof cbOrderId !== 'string') ||
    String(cbOrderId).length === 0 ||
    !cbStatus ||
    !cbCurrency ||
    cbAmount == null
  ) {
    setResponseStatus(event, 400)
    return { received: false }
  }

  try {
    const supabase = supabaseAdmin()

    const found = await supabase
      .from('orders')
      .select('id, order_number, status, email, subtotal_usd_cents, go2pay_order_id, go2pay_request_id, created_at')
      .eq('payment_callback_token', token)
      .maybeSingle()

    if (found.error) {
      console.error('[go2pay callback] order lookup failed:', found.error.message)
      setResponseStatus(event, 500)
      return { received: false }
    }

    const order = found.data
    if (!order) {
      setResponseStatus(event, 404)
      return { received: false }
    }

    // Idempotent: already finalised.
    if (order.status === 'paid') {
      return { received: true }
    }

    // A different Go2Pay order must never finalise this Bahama Mama order.
    if (order.go2pay_order_id != null && String(order.go2pay_order_id) !== String(cbOrderId)) {
      console.error('[go2pay callback] order', order.id, 'already bound to another go2pay order id')
      return { received: true }
    }

    // Only a PAID callback is worth verifying; anything else is acknowledged
    // and the order left pending.
    if (cbStatus !== 'PAID') {
      return { received: true }
    }

    // ── Independent verification via Go2Pay Orders API ──
    const lookup = await getOrder(cbOrderId)

    // Diagnostic: field NAMES only (no values) so we can confirm the real
    // response shape on the first live payment without logging PII.
    console.log(
      '[go2pay callback] shapes — callback keys:',
      Object.keys(body || {}).join(','),
      '| order keys:',
      Object.keys(lookup.data || {}).join(',')
    )

    if (!lookup.ok || !lookup.data) {
      console.error('[go2pay callback] GET /orders failed (HTTP', lookup.status + ') for order', order.id)
      setResponseStatus(event, 502)
      return { received: false }
    }

    const g = lookup.data
    const gAmountCents = toCents(g.subtotal ?? g.price)
    const gPaymentId = norm(g.payment_id) || norm(body?.payment_id) || null
    const gTimestamp = g.paid_at ?? g.created ?? g.created_at ?? null

    const checks = {
      status: upper(g.status) === 'PAID',
      currency: upper(g.currency) === 'USD',
      amount: Number.isFinite(gAmountCents) && gAmountCents === order.subtotal_usd_cents,
      email: !!lower(g.email) && lower(g.email) === lower(order.email),
      paymentId: !!gPaymentId
    }

    // Provider timestamp must not predate our local order (tolerant of skew).
    if (gTimestamp) {
      const ts = Date.parse(gTimestamp)
      const localTs = Date.parse(order.created_at)
      checks.timestamp =
        !Number.isFinite(ts) || !Number.isFinite(localTs) ? true : ts >= localTs - CLOCK_TOLERANCE_MS
    }

    // Optional bonus: if Go2Pay's real response exposes a request identifier,
    // require it to match ours. Undocumented — only enforced if actually present.
    const gRequestId = g.request_id ?? g.payment_request_id ?? null
    if (gRequestId != null && order.go2pay_request_id != null) {
      checks.requestLink = String(gRequestId) === String(order.go2pay_request_id)
    }

    const failed = Object.entries(checks)
      .filter(([, ok]) => !ok)
      .map(([k]) => k)

    if (failed.length > 0) {
      console.error('[go2pay callback] verification failed for order', order.id, '— checks:', failed.join(','))
      return { received: true } // acknowledge; do NOT mark paid
    }

    // ── Mark paid: idempotent, first-write-wins on status ──
    const updated = await supabase
      .from('orders')
      .update({
        status: 'paid',
        payment_provider: 'go2pay',
        go2pay_order_id: cbOrderId,
        payment_id: gPaymentId,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()

    if (updated.error) {
      // Unique-index violation on go2pay_order_id / payment_id => already
      // finalised by a concurrent callback. Treat as success.
      if (updated.error.code === '23505') {
        return { received: true }
      }
      console.error('[go2pay callback] mark-paid failed for order', order.id, updated.error.message)
      setResponseStatus(event, 500)
      return { received: false }
    }

    // updated.data === null => row was no longer 'pending' (already finalised).
    return { received: true }
  } catch (err) {
    console.error('[go2pay callback] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { received: false }
  }
})
