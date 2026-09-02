import { buildValidatedOrder } from '../utils/checkoutOrder.js'
import { supabaseAdmin } from '../utils/supabaseAdmin.js'
import { createPaymentRequest } from '../utils/go2pay.js'
import { siteUrl } from '../utils/siteUrl.js'

const GENERIC_ERROR = 'We couldn’t place your order right now. Please try again.'
const PAYMENT_INIT_ERROR = 'We couldn’t start payment right now. Please try again in a moment.'

const displayNumber = (orderNumber) => `BM-${String(orderNumber).padStart(6, '0')}`

/**
 * POST /api/checkout
 *
 * Validate cart server-side → create (or reuse) a pending Supabase order + items
 * → create a Go2Pay Payment Request → persist the request info → return the
 * hosted payment URL. Status stays 'pending' until the Go2Pay callback
 * independently verifies payment.
 *
 * Retry-safe: a repeat call with the same client `checkoutId` resumes the same
 * pending order instead of creating a new one (see the idempotency lookup).
 *
 * Never trusts client money/names/images (checkoutOrder.js). Never returns raw
 * Supabase/Go2Pay errors, credentials, tokens or callback tokens.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null)

  const result = buildValidatedOrder(body)
  if (!result.ok) {
    setResponseStatus(event, 400)
    return { success: false, error: result.error, issues: result.issues }
  }

  const { orderRow, itemRows, subtotalUsdCents } = result
  const checkoutId = orderRow.checkout_idempotency_key

  try {
    const supabase = supabaseAdmin()

    // ── 1. Idempotency: is there already an order for this checkout attempt? ──
    const existing = await supabase
      .from('orders')
      .select('id, order_number, status, first_name, last_name, email, phone, subtotal_usd_cents, payment_callback_token, go2pay_payment_url')
      .eq('checkout_idempotency_key', checkoutId)
      .maybeSingle()

    if (existing.error) {
      console.error('[checkout] idempotency lookup failed:', existing.error.message)
      setResponseStatus(event, 500)
      return { success: false, error: GENERIC_ERROR }
    }

    let order = existing.data

    if (order) {
      if (order.status === 'paid') {
        return { success: true, alreadyPaid: true, displayOrderNumber: displayNumber(order.order_number) }
      }
      if (order.go2pay_payment_url) {
        return { success: true, paymentUrl: order.go2pay_payment_url, displayOrderNumber: displayNumber(order.order_number) }
      }
      // Order exists but the Go2Pay step never completed — fall through and retry it.
    } else {
      // ── 2. Create the pending order + items (first attempt) ──
      const inserted = await supabase
        .from('orders')
        .insert(orderRow)
        .select('id, order_number, first_name, last_name, email, phone, subtotal_usd_cents, payment_callback_token')
        .single()

      if (inserted.error || !inserted.data) {
        // Concurrent request won the race on the unique idempotency key.
        if (inserted.error?.code === '23505') {
          const raced = await supabase
            .from('orders')
            .select('id, order_number, status, first_name, last_name, email, phone, subtotal_usd_cents, payment_callback_token, go2pay_payment_url')
            .eq('checkout_idempotency_key', checkoutId)
            .maybeSingle()
          if (raced.data?.status === 'paid') {
            return { success: true, alreadyPaid: true, displayOrderNumber: displayNumber(raced.data.order_number) }
          }
          if (raced.data?.go2pay_payment_url) {
            return { success: true, paymentUrl: raced.data.go2pay_payment_url, displayOrderNumber: displayNumber(raced.data.order_number) }
          }
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
          // Avoid an orphan order (order_items.order_id is ON DELETE CASCADE).
          console.error('[checkout] order_items insert failed — rolling back order', order.id, items.error.message)
          await supabase.from('orders').delete().eq('id', order.id)
          setResponseStatus(event, 500)
          return { success: false, error: GENERIC_ERROR }
        }
      }
    }

    // ── 3. Create the Go2Pay Payment Request (documented fields only) ──
    const displayOrderNumber = displayNumber(order.order_number)
    let base
    try {
      base = siteUrl()
    } catch (err) {
      console.error('[checkout] site URL not configured:', err.message)
      setResponseStatus(event, 500)
      return { success: false, error: PAYMENT_INIT_ERROR }
    }

    let go2pay
    try {
      go2pay = await createPaymentRequest({
        name: `${order.first_name} ${order.last_name}`.trim(),
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
      // Order stays 'pending' with no payment URL; a retry with the same
      // checkoutId re-enters here without creating a new order.
      console.error('[checkout] Go2Pay create-request failed for order', order.id, '—', err.message)
      setResponseStatus(event, 502)
      return { success: false, error: PAYMENT_INIT_ERROR }
    }

    // ── 4. Persist the Go2Pay request info; status remains 'pending' ──
    const saved = await supabase
      .from('orders')
      .update({
        go2pay_request_id: go2pay.id,
        go2pay_payment_url: go2pay.payment_url,
        payment_provider: 'go2pay'
      })
      .eq('id', order.id)
      .eq('status', 'pending')

    if (saved.error) {
      // The request exists at Go2Pay but we failed to record it. The customer
      // can still pay (URL returned below); the callback reconciles via the
      // per-order callback token. Logged for manual follow-up.
      console.error('[checkout] failed to persist Go2Pay request for order', order.id, '—', saved.error.message)
    }

    return { success: true, paymentUrl: go2pay.payment_url, displayOrderNumber }
  } catch (err) {
    console.error('[checkout] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { success: false, error: GENERIC_ERROR }
  }
})
