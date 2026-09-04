import { buildValidatedOrder } from '../utils/checkoutOrder.js'
import { supabaseAdmin } from '../utils/supabaseAdmin.js'
import { createPaymentRequest, getPaymentRequest } from '../utils/go2pay.js'
import { siteUrl } from '../utils/siteUrl.js'
import { getOptionalUserId } from '../utils/authUser.js'

const GENERIC_ERROR = 'We couldn’t place your order right now. Please try again.'
const PAYMENT_INIT_ERROR = 'We couldn’t start payment right now. Please try again in a moment.'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const displayNumber = (orderNumber) => `BM-${String(orderNumber).padStart(6, '0')}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Run a guarded Supabase UPDATE, retrying ONLY on a transient error (never on a
 * 0-rows-matched result — that means the guard legitimately didn't apply).
 * 3 attempts, ~200ms then ~400ms backoff.
 */
async function updateWithRetry(build) {
  const backoff = [200, 400]
  let res
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await build()
    if (!res.error) return res
    if (attempt < backoff.length) await sleep(backoff[attempt])
  }
  return res
}

/**
 * POST /api/checkout
 *
 * Validate cart server-side → create (or reuse) a pending Supabase order + items
 * → resolve the order's Go2Pay Payment Request → return the hosted payment URL.
 * Status stays 'pending' until the Go2Pay callback independently verifies.
 *
 * Persistence invariant: a `paymentUrl` is returned ONLY after both
 * `go2pay_request_id` and `go2pay_payment_url` are confirmed persisted. A
 * non-null `go2pay_request_id` is never overwritten. A saved request is always
 * reused (state 1) or recovered (state 2) — never replaced.
 *
 * Never trusts client money/names/images. Never returns raw Supabase/Go2Pay
 * errors, credentials, tokens or callback tokens.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null)

  const result = buildValidatedOrder(body)
  if (!result.ok) {
    setResponseStatus(event, 400)
    return { success: false, error: result.error, issues: result.issues }
  }

  const { orderRow, itemRows } = result
  const checkoutId = orderRow.checkout_idempotency_key

  // Attach the verified signed-in customer, or null for guest checkout.
  // NEVER read from the request body. Only used on a fresh insert (step 2);
  // an existing order's user_id is left untouched on retry.
  orderRow.user_id = await getOptionalUserId(event)

  const ORDER_COLS =
    'id, order_number, status, first_name, last_name, email, phone, subtotal_usd_cents, payment_callback_token, go2pay_request_id, go2pay_payment_url'

  try {
    const supabase = supabaseAdmin()

    // ── 1. Idempotency: existing order for this checkout attempt? ──
    const existing = await supabase
      .from('orders')
      .select(ORDER_COLS)
      .eq('checkout_idempotency_key', checkoutId)
      .maybeSingle()

    if (existing.error) {
      console.error('[checkout] idempotency lookup failed:', existing.error.message)
      setResponseStatus(event, 500)
      return { success: false, error: GENERIC_ERROR }
    }

    let order = existing.data

    // ── 2. Create the pending order + items (first attempt only) ──
    if (!order) {
      const inserted = await supabase.from('orders').insert(orderRow).select(ORDER_COLS).single()

      if (inserted.error || !inserted.data) {
        if (inserted.error?.code === '23505') {
          // Concurrent request won the unique idempotency-key race.
          const raced = await supabase
            .from('orders')
            .select(ORDER_COLS)
            .eq('checkout_idempotency_key', checkoutId)
            .maybeSingle()
          order = raced.data
        }
        if (!order) {
          console.error('[checkout] orders insert failed:', inserted.error?.message)
          setResponseStatus(event, 500)
          return { success: false, error: GENERIC_ERROR }
        }
      } else {
        order = inserted.data

        const items = await supabase
          .from('order_items')
          .insert(itemRows.map((row) => ({ ...row, order_id: order.id })))

        if (items.error) {
          console.error('[checkout] order_items insert failed — rolling back order', order.id, items.error.message)
          await supabase.from('orders').delete().eq('id', order.id)
          setResponseStatus(event, 500)
          return { success: false, error: GENERIC_ERROR }
        }
      }
    }

    // ── 3. Resolve the Go2Pay Payment Request for this order ──
    const displayOrderNumber = displayNumber(order.order_number)
    const savedRequestId = order.go2pay_request_id ?? null
    const savedUrl = order.go2pay_payment_url ?? null

    if (order.status === 'paid') {
      return { success: true, alreadyPaid: true, displayOrderNumber }
    }

    // STATE 1 — request id + url both persisted → reuse, never re-mint.
    if (savedUrl) {
      if (!savedRequestId) {
        console.error('[checkout] anomaly: payment_url without request_id', JSON.stringify({ orderId: order.id }))
      }
      return { success: true, paymentUrl: savedUrl, displayOrderNumber }
    }

    // STATE 2 — request claimed but url missing → recover it, never re-mint.
    if (savedRequestId) {
      const reqLookup = await getPaymentRequest(savedRequestId)
      const recoveredUrl =
        reqLookup.ok && reqLookup.data && typeof reqLookup.data.payment_url === 'string'
          ? reqLookup.data.payment_url
          : null

      if (!recoveredUrl) {
        console.error(
          '[checkout] state2: payment_url not recoverable',
          JSON.stringify({ orderId: order.id, go2payRequestId: savedRequestId, http: reqLookup.status })
        )
        setResponseStatus(event, 502)
        return { success: false, error: PAYMENT_INIT_ERROR }
      }

      const fin = await updateWithRetry(() =>
        supabase
          .from('orders')
          .update({ go2pay_payment_url: recoveredUrl, payment_provider: 'go2pay' })
          .eq('id', order.id)
          .eq('status', 'pending')
          .eq('go2pay_request_id', savedRequestId)
          .is('go2pay_payment_url', null)
          .select('id')
      )

      if (fin.error || !fin.data?.length) {
        const re = await supabase
          .from('orders')
          .select('status, go2pay_payment_url')
          .eq('id', order.id)
          .maybeSingle()
        if (re.data?.status === 'paid') return { success: true, alreadyPaid: true, displayOrderNumber }
        if (re.data?.go2pay_payment_url) {
          return { success: true, paymentUrl: re.data.go2pay_payment_url, displayOrderNumber }
        }
        console.error(
          '[checkout] state2: finalize failed',
          JSON.stringify({ orderId: order.id, err: fin.error?.message ?? '0-rows' })
        )
        setResponseStatus(event, 502)
        return { success: false, error: PAYMENT_INIT_ERROR }
      }

      return { success: true, paymentUrl: recoveredUrl, displayOrderNumber }
    }

    // STATE 3 — nothing persisted → create exactly one request, CLAIM, FINALIZE.
    let base
    try {
      base = siteUrl()
    } catch (err) {
      console.error('[checkout] site URL not configured:', err.message)
      setResponseStatus(event, 500)
      return { success: false, error: PAYMENT_INIT_ERROR }
    }

    const requestName =
      itemRows.length === 1 ? itemRows[0].product_name : `Bahama Mama Order ${displayOrderNumber}`

    console.log(
      '[checkout] Go2Pay request —',
      JSON.stringify({
        orderId: order.id,
        callbackOrigin: base,
        callbackPath: '/api/payments/go2pay/<token>',
        callbackTokenValid: UUID_RE.test(String(order.payment_callback_token || '')),
        requestName,
        sendEmail: false
      })
    )

    let go2pay
    try {
      go2pay = await createPaymentRequest({
        name: requestName,
        email: order.email,
        phone: order.phone,
        amount: Number((order.subtotal_usd_cents / 100).toFixed(2)),
        description: `Bahama Mama Order ${displayOrderNumber}`,
        endpoint: `${base}/api/payments/go2pay/${order.payment_callback_token}`,
        success_url: `${base}/checkout/return?o=${encodeURIComponent(displayOrderNumber)}`,
        error_url: `${base}/checkout/cancelled`,
        send_email: false
      })
    } catch (err) {
      console.error('[checkout] Go2Pay create-request failed for order', order.id, '—', err.message)
      setResponseStatus(event, 502)
      return { success: false, error: PAYMENT_INIT_ERROR }
    }

    console.log(
      '[checkout] Go2Pay request created —',
      JSON.stringify({
        go2payRequestId: go2pay.id,
        sentName: requestName,
        go2payTitle: go2pay.title ?? null,
        sentSendEmail: false,
        go2payEmailSent: go2pay.email_sent ?? null
      })
    )

    // CLAIM — `is('go2pay_request_id', null)` guarantees a non-null id is never overwritten.
    const claim = await updateWithRetry(() =>
      supabase
        .from('orders')
        .update({ go2pay_request_id: go2pay.id, payment_provider: 'go2pay' })
        .eq('id', order.id)
        .eq('status', 'pending')
        .is('go2pay_request_id', null)
        .select('id')
    )

    if (claim.error || !claim.data?.length) {
      // The Go2Pay request we just created could not be recorded → orphan.
      console.error(
        '[checkout] CLAIM failed — orphan Go2Pay request',
        JSON.stringify({
          orderId: order.id,
          go2payRequestId: go2pay.id,
          reason: claim.error ? claim.error.message : '0-rows (concurrent claim or state change)'
        })
      )
      const re = await supabase
        .from('orders')
        .select('status, go2pay_payment_url')
        .eq('id', order.id)
        .maybeSingle()
      if (re.data?.status === 'paid') return { success: true, alreadyPaid: true, displayOrderNumber }
      if (re.data?.go2pay_payment_url) {
        return { success: true, paymentUrl: re.data.go2pay_payment_url, displayOrderNumber }
      }
      setResponseStatus(event, 502)
      return { success: false, error: PAYMENT_INIT_ERROR }
    }

    // FINALIZE — persist the URL for the request we just claimed.
    const fin = await updateWithRetry(() =>
      supabase
        .from('orders')
        .update({ go2pay_payment_url: go2pay.payment_url })
        .eq('id', order.id)
        .eq('status', 'pending')
        .eq('go2pay_request_id', go2pay.id)
        .is('go2pay_payment_url', null)
        .select('id')
    )

    if (fin.error || !fin.data?.length) {
      const re = await supabase
        .from('orders')
        .select('status, go2pay_payment_url')
        .eq('id', order.id)
        .maybeSingle()
      if (re.data?.status === 'paid') return { success: true, alreadyPaid: true, displayOrderNumber }
      if (re.data?.go2pay_payment_url) {
        return { success: true, paymentUrl: re.data.go2pay_payment_url, displayOrderNumber }
      }
      // request_id is saved, url is not → order is recoverable via STATE 2 on the
      // next retry. Do NOT expose this URL.
      console.error(
        '[checkout] FINALIZE failed — order left recoverable (state 2)',
        JSON.stringify({ orderId: order.id, go2payRequestId: go2pay.id, err: fin.error?.message ?? '0-rows' })
      )
      setResponseStatus(event, 502)
      return { success: false, error: PAYMENT_INIT_ERROR }
    }

    return { success: true, paymentUrl: go2pay.payment_url, displayOrderNumber }
  } catch (err) {
    console.error('[checkout] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { success: false, error: GENERIC_ERROR }
  }
})
