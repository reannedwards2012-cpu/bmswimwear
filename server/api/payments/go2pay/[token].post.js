import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { verifyAndMarkPaid } from '../../../utils/go2payVerify.js'

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

const norm = (v) => (typeof v === 'string' ? v.trim() : '')
const upper = (v) => norm(v).toUpperCase()

// verify-outcome → { HTTP status, `received` value, diagnostic label }
const OUTCOME_MAP = {
  'already-paid': { http: 200, received: true, label: 'noop:already-paid' },
  'bound-to-different-go2pay-order': { http: 200, received: true, label: 'rejected:bound-to-different-go2pay-order' },
  'get-orders-failed': { http: 502, received: false, label: 'error:get-orders-failed' },
  'verification-failed': { http: 200, received: true, label: 'rejected:verification-failed' },
  'mark-paid-failed': { http: 500, received: false, label: 'error:mark-paid-failed' },
  'unique-violation-already-final': { http: 200, received: true, label: 'noop:unique-violation-already-final' },
  'marked-paid': { http: 200, received: true, label: 'success:marked-paid' },
  'no-longer-pending': { http: 200, received: true, label: 'noop:no-longer-pending' }
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

    // Callback-only shortcut: a non-PAID callback has nothing to verify.
    if (order.status !== 'paid' && cbStatus !== 'PAID') {
      diag('noop:callback-status-not-paid', { orderId: order.id, cbStatus })
      return { received: true }
    }

    // ── Shared verification + mark-paid (server/utils/go2payVerify.js) ──
    const r = await verifyAndMarkPaid(supabase, order, cbOrderId)
    const m = OUTCOME_MAP[r.outcome] || { http: 500, received: false, label: 'error:unknown-outcome' }

    diag(m.label, {
      orderId: order.id,
      cbOrderId,
      ...(r.failedChecks ? { failedChecks: r.failedChecks } : {}),
      ...(r.emailMatch != null ? { emailMatch: r.emailMatch } : {}),
      ...(r.savedRequestId != null ? { savedRequestId: r.savedRequestId } : {}),
      ...(r.go2payOrderProductId != null ? { go2payOrderProductId: r.go2payOrderProductId } : {}),
      ...(r.getOrderHttp != null ? { getOrderHttp: r.getOrderHttp } : {}),
      ...(r.boundOrderId != null ? { boundOrderId: r.boundOrderId } : {}),
      ...(r.supabaseError ? { supabaseError: r.supabaseError } : {}),
      callbackKeys: bodyKeys,
      ...(r.go2pay?.orderKeys ? { orderKeys: r.go2pay.orderKeys } : {})
    })

    if (m.http !== 200) setResponseStatus(event, m.http)
    return { received: m.received }
  } catch (err) {
    diag('error:unexpected', { message: err?.message })
    setResponseStatus(event, 500)
    return { received: false }
  }
})
