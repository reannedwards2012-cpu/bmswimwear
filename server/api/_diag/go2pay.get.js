/**
 * ══════════════════════════════════════════════════════════════════════════
 *  TEMPORARY read-only diagnostic — DELETE this file after the request_id
 *  investigation is complete. Added 2026-09-03.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * GET /api/_diag/go2pay?token=<payment_callback_token>&go2payOrderId=<n>
 *
 * Gated by knowledge of a real order's secret `payment_callback_token` (same
 * trust level as the callback route). Read-only: no order is modified. Returns
 * ONLY provider/order identifiers, their types, and comparison results — no
 * email, name, payment_id value, credentials, JWT, or the callback token.
 *
 * Purpose: confirm whether Go2Pay's real `GET /orders/{id}.request_id` equals
 * our saved `go2pay_request_id`, i.e. whether a direct Payment Request → Order
 * linkage exists.
 */
import { supabaseAdmin } from '../../utils/supabaseAdmin.js'
import { getOrder, getPaymentRequest } from '../../utils/go2pay.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v)
const has = (v) => typeof v === 'string' && v.length > 0

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const token = typeof q.token === 'string' ? q.token.trim() : ''
  const go2payOrderId = typeof q.go2payOrderId === 'string' ? q.go2payOrderId.trim() : ''

  if (!UUID_RE.test(token) || !/^\d+$/.test(go2payOrderId)) {
    setResponseStatus(event, 400)
    return { error: 'usage: ?token=<payment_callback_token>&go2payOrderId=<number>' }
  }

  try {
    const supabase = supabaseAdmin()
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, status, subtotal_usd_cents, go2pay_request_id, go2pay_order_id, created_at')
      .eq('payment_callback_token', token)
      .maybeSingle()

    if (error || !order) {
      setResponseStatus(event, 404)
      return { error: 'no order for that token' }
    }

    const savedRequestId = order.go2pay_request_id

    // read-only Go2Pay calls
    const ordLookup = await getOrder(go2payOrderId)
    const g = ordLookup.data && typeof ordLookup.data === 'object' ? ordLookup.data : {}
    const gRequestId = g.request_id ?? g.payment_request_id ?? null

    const reqLookup = savedRequestId != null ? await getPaymentRequest(savedRequestId) : null
    const r = reqLookup?.data && typeof reqLookup.data === 'object' ? reqLookup.data : {}

    console.log(
      '[diag go2pay]',
      JSON.stringify({
        savedRequestId,
        savedRequestIdType: typeOf(savedRequestId),
        go2payOrderRequestId: gRequestId,
        go2payOrderRequestIdType: typeOf(gRequestId),
        stringEqual: gRequestId != null && savedRequestId != null && String(savedRequestId) === String(gRequestId),
        apiOrderId: g.api_order_id ?? null,
        apiOrderIdType: typeOf(g.api_order_id ?? null)
      })
    )

    return {
      supabase: {
        internalOrderId: order.id,
        status: order.status,
        subtotalUsdCents: order.subtotal_usd_cents,
        go2payRequestId: savedRequestId,
        go2payRequestIdType: typeOf(savedRequestId),
        go2payOrderIdBound: order.go2pay_order_id
      },
      go2payOrder: {
        http: ordLookup.status,
        keys: Object.keys(g),
        id: g.id ?? null,
        idType: typeOf(g.id),
        requestId: gRequestId,
        requestIdType: typeOf(gRequestId),
        apiOrderId: g.api_order_id ?? null,
        apiOrderIdType: typeOf(g.api_order_id ?? null),
        productId: g.product_id ?? null,
        productIdType: typeOf(g.product_id ?? null),
        status: g.status ?? null,
        currency: g.currency ?? null,
        subtotalMatchesSupabase:
          Number.isFinite(Number(g.subtotal)) &&
          Math.round(Number(g.subtotal) * 100) === order.subtotal_usd_cents,
        hasPaymentId: has(g.payment_id),
        hasEmail: has(g.email)
      },
      go2payRequest: reqLookup
        ? {
            http: reqLookup.status,
            keys: Object.keys(r),
            id: r.id ?? null,
            idType: typeOf(r.id ?? null),
            title: typeof r.title === 'string' ? r.title : null,
            orderId: r.order_id ?? null,
            orderIdType: typeOf(r.order_id ?? null),
            status: r.status ?? null
          }
        : null,
      comparison: {
        savedRequestId,
        go2payOrderRequestId: gRequestId,
        rawStrictEqual: savedRequestId === gRequestId,
        stringEqual:
          gRequestId != null &&
          savedRequestId != null &&
          String(savedRequestId) === String(gRequestId)
      }
    }
  } catch (err) {
    console.error('[diag go2pay] error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'diagnostic failed' }
  }
})
