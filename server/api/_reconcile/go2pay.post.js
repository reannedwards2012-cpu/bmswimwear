/**
 * ══════════════════════════════════════════════════════════════════════════
 *  TEMPORARY server-only reconciliation — DELETE this file (and its parent
 *  _reconcile/ dir) and redeploy once Go2Pay Order 28531 is reconciled.
 *  Added 2026-09-03. Not an admin feature; single-purpose.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * POST /api/_reconcile/go2pay
 *   body/query: { token | orderUuid, go2payOrderId }
 *
 * Read / verify / update only — NEVER creates a Go2Pay Payment Request.
 * Identifies the pending Bahama Mama order by its `payment_callback_token`
 * (secret UUID) or its exact order UUID, fetches the given Go2Pay order via the
 * authenticated server client, and runs the EXACT same verification + idempotent
 * mark-paid as the live callback (server/utils/go2payVerify.js — one shared
 * implementation, cannot drift).
 *
 * Response carries only safe fields: check results, booleans, provider/order
 * IDs and the display order number. No tokens, payment_id value, JWT, customer
 * PII, credentials or payment URLs.
 */
import { supabaseAdmin } from '../../utils/supabaseAdmin.js'
import { verifyAndMarkPaid } from '../../utils/go2payVerify.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const displayNumber = (n) => `BM-${String(n).padStart(6, '0')}`

const pick = (a, b) => (typeof a === 'string' ? a.trim() : typeof b === 'string' ? b.trim() : '')

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const body = (await readBody(event).catch(() => null)) || {}

  const token = pick(body.token, q.token)
  const orderUuid = pick(body.orderUuid, q.orderUuid)
  const go2payOrderId = String(body.go2payOrderId ?? q.go2payOrderId ?? '').trim()

  const byToken = UUID_RE.test(token)
  const byUuid = UUID_RE.test(orderUuid)

  if ((!byToken && !byUuid) || !/^\d+$/.test(go2payOrderId)) {
    setResponseStatus(event, 400)
    return { error: 'provide token OR orderUuid (UUID), plus numeric go2payOrderId' }
  }

  try {
    const supabase = supabaseAdmin()

    const query = supabase
      .from('orders')
      .select(
        'id, order_number, status, email, subtotal_usd_cents, go2pay_order_id, go2pay_request_id, created_at'
      )
    const found = await (byToken
      ? query.eq('payment_callback_token', token)
      : query.eq('id', orderUuid)
    ).maybeSingle()

    if (found.error) {
      console.error('[reconcile] order lookup failed:', found.error.message)
      setResponseStatus(event, 500)
      return { error: 'lookup failed' }
    }
    if (!found.data) {
      setResponseStatus(event, 404)
      return { error: 'no matching order' }
    }

    const order = found.data
    const r = await verifyAndMarkPaid(supabase, order, go2payOrderId)

    console.log(
      '[reconcile]',
      JSON.stringify({
        displayOrderNumber: displayNumber(order.order_number),
        go2payOrderId,
        outcome: r.outcome,
        verified: r.verified,
        marked: r.marked,
        failedChecks: r.failedChecks ?? [],
        emailMatch: r.emailMatch ?? null,
        savedRequestId: order.go2pay_request_id ?? null,
        go2payOrderProductId: r.go2payOrderProductId ?? null,
        supabaseError: r.supabaseError ?? undefined
      })
    )

    const http =
      r.outcome === 'get-orders-failed' || r.outcome === 'mark-paid-failed' ? 502 : 200
    if (http !== 200) setResponseStatus(event, http)

    return {
      displayOrderNumber: displayNumber(order.order_number),
      go2payOrderId,
      outcome: r.outcome,
      verified: !!r.verified,
      marked: !!r.marked,
      checks: r.checks ?? null,
      failedChecks: r.failedChecks ?? [],
      emailMatch: r.emailMatch ?? null,
      savedRequestId: order.go2pay_request_id ?? null,
      go2payOrderProductId: r.go2payOrderProductId ?? null,
      go2pay: r.go2pay
        ? {
            status: r.go2pay.status,
            currency: r.go2pay.currency,
            amountMatches: r.go2pay.amountMatches,
            hasPaymentId: r.go2pay.hasPaymentId,
            productId: r.go2pay.productId,
            orderKeys: r.go2pay.orderKeys
          }
        : null,
      ...(r.getOrderHttp != null ? { getOrderHttp: r.getOrderHttp } : {}),
      ...(r.boundOrderId != null ? { boundOrderId: r.boundOrderId } : {})
    }
  } catch (err) {
    console.error('[reconcile] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'reconcile failed' }
  }
})
