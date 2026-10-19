import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { verifyAndConfirmBikiniMixBooking } from '../../../utils/bikiniMixPayments.js'
import { maybeSendBikiniMixBookingEmails } from '../../../utils/bikiniMixBookingEmails.js'

/**
 * POST /api/payments/go2pay-bikini-mix/[token]
 *
 * Go2Pay payment callback for Bikini Mixer bookings. `token` is the
 * booking's server-generated `payment_callback_token` — a per-booking UUID
 * never exposed to the browser. Entirely separate from
 * server/api/payments/go2pay/[token].post.js (product orders) — different
 * table, different token column, different verification module — so a bug
 * or outage in one can never affect the other.
 *
 * The callback body is a SIGNAL ONLY. A booking's payment is verified
 * solely via an independent GET /orders/{id} to Go2Pay (see
 * server/utils/bikiniMixPayments.js for the exact checks). Confirming is
 * never a raw UPDATE — it always goes through the
 * confirm_bikini_mix_booking_payment() RPC, which atomically decides
 * 'confirmed' vs 'paid_needs_review' under the same capacity lock
 * claim_bikini_mix_booking() uses. Processing is idempotent; a repeat
 * callback for an already-verified booking is a no-op.
 *
 * Every branch emits ONE diagnostic line with safe fields only — never the
 * token value, customer data, monetary amounts, payment_id, JWTs or the
 * payment URL. Responses to Go2Pay are minimal ({ received: bool }).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const norm = (v) => (typeof v === 'string' ? v.trim() : '')
const upper = (v) => norm(v).toUpperCase()

const OUTCOME_MAP = {
  'already-paid': { http: 200, received: true, label: 'noop:already-paid' },
  'bound-to-different-go2pay-order': { http: 200, received: true, label: 'rejected:bound-to-different-go2pay-order' },
  'get-orders-failed': { http: 502, received: false, label: 'error:get-orders-failed' },
  'verification-failed': { http: 200, received: true, label: 'rejected:verification-failed' },
  'confirm-rpc-failed': { http: 500, received: false, label: 'error:confirm-rpc-failed' },
  confirmed: { http: 200, received: true, label: 'success:confirmed' },
  'needs-review': { http: 200, received: true, label: 'success:needs-review' }
}

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
      '[go2pay-bikini-mix callback]',
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
    diag('rejected:bad-body-shape', { bodyType: typeof rawBody, parseSource: source, bodyKeys, cbStatus, cbCurrency })
    setResponseStatus(event, 400)
    return { received: false }
  }

  try {
    const supabase = supabaseAdmin()

    const found = await supabase
      .from('bikini_mix_bookings')
      .select('id, booking_number, status, paid_at, email, charged_usd_cents, go2pay_order_id, go2pay_request_id, created_at')
      .eq('payment_callback_token', token)
      .maybeSingle()

    if (found.error) {
      diag('error:booking-lookup', { supabaseError: found.error.message })
      setResponseStatus(event, 500)
      return { received: false }
    }

    const booking = found.data
    if (!booking) {
      diag('rejected:no-booking-for-token', { cbStatus })
      setResponseStatus(event, 404)
      return { received: false }
    }

    // Callback-only shortcut: a non-PAID callback has nothing to verify.
    if (!booking.paid_at && cbStatus !== 'PAID') {
      diag('noop:callback-status-not-paid', { bookingId: booking.id, cbStatus })
      return { received: true }
    }

    const r = await verifyAndConfirmBikiniMixBooking(supabase, booking, cbOrderId)
    const m = OUTCOME_MAP[r.outcome] || { http: 500, received: false, label: 'error:unknown-outcome' }

    diag(m.label, {
      bookingId: booking.id,
      cbOrderId,
      ...(r.failedChecks ? { failedChecks: r.failedChecks } : {}),
      ...(r.emailMatch != null ? { emailMatch: r.emailMatch } : {}),
      ...(r.getOrderHttp != null ? { getOrderHttp: r.getOrderHttp } : {}),
      ...(r.boundOrderId != null ? { boundOrderId: r.boundOrderId } : {}),
      ...(r.supabaseError ? { supabaseError: r.supabaseError } : {}),
      callbackKeys: bodyKeys,
      ...(r.go2pay?.orderKeys ? { orderKeys: r.go2pay.orderKeys } : {})
    })

    const PAID_OUTCOMES = ['confirmed', 'needs-review', 'already-paid']
    if (PAID_OUTCOMES.includes(r.outcome)) {
      await maybeSendBikiniMixBookingEmails(supabase, booking.id).catch((e) =>
        console.error('[go2pay-bikini-mix callback] paid-email dispatch error:', e?.message)
      )
    }

    if (m.http !== 200) setResponseStatus(event, m.http)
    return { received: m.received }
  } catch (err) {
    diag('error:unexpected', { message: err?.message })
    setResponseStatus(event, 500)
    return { received: false }
  }
})
