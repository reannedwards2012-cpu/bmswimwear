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
 * Every branch emits ONE diagnostic line with safe fields only — never the
 * token value, customer data, monetary amounts, payment_id, JWTs or the
 * payment URL. Responses to Go2Pay are minimal ({ received: bool }).
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

/**
 * (B) Defensive body extraction — pre-verification only.
 *  - string body            -> JSON.parse
 *  - { …, data: {…} } wrapper (with no top-level order_id) -> unwrap `data`
 * The independent payment verification below is unchanged.
 */
function extractPayload(rawBody) {
  let b = rawBody
  let source = 'direct'

  if (typeof b === 'string') {
    try {
      b = JSON.parse(b)
      source = 'json-string'
    } catch {
      return { payload: null, source: 'unparseable-string' }
    }
  }
  if (!b || typeof b !== 'object' || Array.isArray(b)) {
    return { payload: null, source: 'non-object' }
  }
  if (b.order_id == null && b.data && typeof b.data === 'object' && !Array.isArray(b.data)) {
    return { payload: b.data, source: source === 'json-string' ? 'json-string+envelope' : 'envelope' }
  }
  return { payload: b, source }
}

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  const contentType = getRequestHeader(event, 'content-type') || ''
  const tokenFormatValid = !!token && UUID_RE.test(token)

  const diag = (outcome, extra = {}) =>
    console.log(
      '[go2pay callback]',
      JSON.stringify({ method: event.method, contentType, tokenFormatValid, outcome, ...extra })
    )

  if (!tokenFormatValid) {
    diag('rejected:bad-token-format')
    setResponseStatus(event, 404)
    return { received: false }
  }

  const rawBody = await readBody(event).catch(() => null)
  const { payload, source } = extractPayload(rawBody)
  const bodyKeys = payload && typeof payload === 'object' ? Object.keys(payload) : []

  const cbOrderId = payload?.order_id
  const cbStatus = upper(payload?.status)
  const cbCurrency = upper(payload?.currency)
  const cbAmount = payload?.subtotal ?? payload?.price

  const shapeOk =
    (typeof cbOrderId === 'number' || typeof cbOrderId === 'string') &&
    String(cbOrderId ?? '').length > 0 &&
    !!cbStatus &&
    !!cbCurrency &&
    cbAmount != null

  if (!shapeOk) {
    diag('rejected:bad-body-shape', {
      bodyType: typeof rawBody,
      parseSource: source,
      bodyKeys,
      cbStatus,
      cbCurrency
    })
    setResponseStatus(event, 400)
    return { received: false }
  }

  try {
    const supabase = supabaseAdmin()

    const found = await supabase
      .from('orders')
      .select(
        'id, order_number, status, email, subtotal_usd_cents, go2pay_order_id, go2pay_request_id, created_at'
      )
      .eq('payment_callback_token', token)
      .maybeSingle()

    if (found.error) {
      diag('error:order-lookup', { supabaseError: found.error.message })
      setResponseStatus(event, 500)
      return { received: false }
    }

    const order = found.data
    if (!order) {
      diag('rejected:no-order-for-token', { cbStatus })
      setResponseStatus(event, 404)
      return { received: false }
    }

    if (order.status === 'paid') {
      diag('noop:already-paid', { orderId: order.id })
      return { received: true }
    }

    if (order.go2pay_order_id != null && String(order.go2pay_order_id) !== String(cbOrderId)) {
      diag('rejected:bound-to-different-go2pay-order', {
        orderId: order.id,
        cbOrderId,
        boundOrderId: order.go2pay_order_id
      })
      return { received: true }
    }

    if (cbStatus !== 'PAID') {
      diag('noop:callback-status-not-paid', { orderId: order.id, cbStatus })
      return { received: true }
    }

    // ── Independent verification via Go2Pay Orders API (UNCHANGED) ──
    const lookup = await getOrder(cbOrderId)
    const orderKeys =
      lookup.data && typeof lookup.data === 'object' ? Object.keys(lookup.data) : []

    if (!lookup.ok || !lookup.data) {
      diag('error:get-orders-failed', {
        orderId: order.id,
        cbOrderId,
        getOrderHttp: lookup.status,
        callbackKeys: bodyKeys
      })
      setResponseStatus(event, 502)
      return { received: false }
    }

    const g = lookup.data
    const gAmountCents = toCents(g.subtotal ?? g.price)
    const gPaymentId = norm(g.payment_id) || norm(payload?.payment_id) || null
    const gTimestamp = g.paid_at ?? g.created ?? g.created_at ?? null

    const checks = {
      status: upper(g.status) === 'PAID',
      currency: upper(g.currency) === 'USD',
      amount: Number.isFinite(gAmountCents) && gAmountCents === order.subtotal_usd_cents,
      email: !!lower(g.email) && lower(g.email) === lower(order.email),
      paymentId: !!gPaymentId
    }

    if (gTimestamp) {
      const ts = Date.parse(gTimestamp)
      const localTs = Date.parse(order.created_at)
      checks.timestamp =
        !Number.isFinite(ts) || !Number.isFinite(localTs) ? true : ts >= localTs - CLOCK_TOLERANCE_MS
    }

    const gRequestId = g.request_id ?? g.payment_request_id ?? null
    if (gRequestId != null && order.go2pay_request_id != null) {
      checks.requestLink = String(gRequestId) === String(order.go2pay_request_id)
    }

    const failed = Object.entries(checks)
      .filter(([, ok]) => !ok)
      .map(([k]) => k)

    if (failed.length > 0) {
      diag('rejected:verification-failed', {
        orderId: order.id,
        cbOrderId,
        failedChecks: failed,
        callbackKeys: bodyKeys,
        orderKeys
      })
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
      if (updated.error.code === '23505') {
        diag('noop:unique-violation-already-final', { orderId: order.id })
        return { received: true }
      }
      diag('error:mark-paid-failed', { orderId: order.id, supabaseError: updated.error.message })
      setResponseStatus(event, 500)
      return { received: false }
    }

    diag(updated.data ? 'success:marked-paid' : 'noop:no-longer-pending', {
      orderId: order.id,
      cbOrderId,
      callbackKeys: bodyKeys,
      orderKeys
    })
    return { received: true }
  } catch (err) {
    diag('error:unexpected', { message: err?.message })
    setResponseStatus(event, 500)
    return { received: false }
  }
})
