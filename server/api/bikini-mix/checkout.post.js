import { supabaseAdmin } from '../../utils/supabaseAdmin.js'
import { validateBookingCheckout } from '../../utils/bikiniMixValidation.js'
import { xcdCentsToUsdCents } from '../../utils/shipping.js'
import { createPaymentRequest, getPaymentRequest } from '../../utils/go2pay.js'
import { siteUrl } from '../../utils/siteUrl.js'

const GENERIC_ERROR = "We couldn't start your booking right now. Please try again."
const PAYMENT_INIT_ERROR = "We couldn't start payment right now. Please try again in a moment."

const PACKAGE_LABEL = { classic_mix: 'Classic Mix', the_works: 'The Works' }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Same guarded-retry helper as server/api/checkout.post.js. */
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
 * POST /api/bikini-mix/checkout
 *
 * Validate the booking payload → claim (or reuse) a hold via
 * claim_bikini_mix_booking() → resolve its Go2Pay Payment Request → return
 * the hosted payment URL. Kept entirely separate from the product-order
 * checkout (own table, own callback path, own Go2Pay request) — never
 * shares a code path with server/api/checkout.post.js beyond the vendor
 * client itself.
 *
 * NOTHING from the client is trusted for the price or fabric names/hex —
 * retail_price_xcd_cents comes from the live bikini_mix_event row, fabric
 * names/hex are re-resolved from `fabrics` by id. The USD amount charged to
 * Go2Pay is always server-computed via xcdCentsToUsdCents (US$1 = EC$2.70).
 *
 * Status stays 'pending_payment' until the Go2Pay callback
 * (server/api/payments/go2pay-bikini-mix/[token].post.js) independently
 * verifies and calls confirm_bikini_mix_booking_payment().
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null)
  const { issues, fields } = validateBookingCheckout(body)
  if (issues.length) {
    setResponseStatus(event, 400)
    return { success: false, error: issues[0], issues }
  }

  try {
    const supabase = supabaseAdmin()

    // ── Authoritative price + fabric resolution — never trust the client ──
    const [{ data: eventRow, error: eventErr }, { data: fabricRows, error: fabricErr }] = await Promise.all([
      supabase
        .from('bikini_mix_event')
        .select('classic_mix_price_xcd_cents, the_works_price_xcd_cents')
        .eq('id', 'default')
        .maybeSingle(),
      supabase
        .from('fabrics')
        .select('id, name, hex_color, is_active, status')
        .in('id', [fields.leftFabricId, fields.rightFabricId, fields.bottomFabricId])
    ])

    if (eventErr || !eventRow) {
      console.error('[bikini-mix checkout] event lookup failed:', eventErr?.message || 'not found')
      setResponseStatus(event, 500)
      return { success: false, error: GENERIC_ERROR }
    }
    if (fabricErr) {
      console.error('[bikini-mix checkout] fabric lookup failed:', fabricErr.message)
      setResponseStatus(event, 500)
      return { success: false, error: GENERIC_ERROR }
    }

    const fabricById = new Map((fabricRows ?? []).map((f) => [f.id, f]))
    const left = fabricById.get(fields.leftFabricId)
    const right = fabricById.get(fields.rightFabricId)
    const bottom = fabricById.get(fields.bottomFabricId)
    const fabricOk = (f) => f && f.is_active && f.status !== 'unavailable'
    if (!fabricOk(left) || !fabricOk(right) || !fabricOk(bottom)) {
      setResponseStatus(event, 400)
      return { success: false, error: 'One of the selected fabrics is no longer available. Please go back and choose again.' }
    }

    const retailPriceXcdCents =
      fields.package === 'the_works' ? eventRow.the_works_price_xcd_cents : eventRow.classic_mix_price_xcd_cents

    // ── Claim the hold (or reuse an existing one — idempotent) ──
    const { data: booking, error: claimErr } = await supabase.rpc('claim_bikini_mix_booking', {
      p_checkout_idempotency_key: fields.checkoutIdempotencyKey,
      p_package: fields.package,
      p_retail_price_xcd_cents: retailPriceXcdCents,
      p_top_size: fields.topSize,
      p_left_fabric_id: left.id,
      p_left_fabric_name: left.name,
      p_left_fabric_hex: left.hex_color,
      p_right_fabric_id: right.id,
      p_right_fabric_name: right.name,
      p_right_fabric_hex: right.hex_color,
      p_bottom_style: fields.bottomStyle,
      p_bottom_coverage: fields.bottomCoverage,
      p_bottom_size: fields.bottomSize,
      p_bottom_fabric_id: bottom.id,
      p_bottom_fabric_name: bottom.name,
      p_bottom_fabric_hex: bottom.hex_color,
      p_full_name: fields.fullName,
      p_email: fields.email,
      p_whatsapp: fields.whatsapp,
      p_personalization_name: fields.personalizationName,
      p_marketing_opt_in: fields.marketingOptIn,
      p_terms_accepted_at: new Date().toISOString()
    })

    if (claimErr || !booking) {
      const code = claimErr?.code
      if (code === '55000') {
        setResponseStatus(event, 409)
        return { success: false, error: claimErr.message || 'Bookings are currently closed.' }
      }
      console.error('[bikini-mix checkout] claim failed:', claimErr?.message)
      setResponseStatus(event, 500)
      return { success: false, error: GENERIC_ERROR }
    }

    const bookingRef = `BKM-${String(booking.booking_number).padStart(6, '0')}`

    if (booking.paid_at) {
      return { success: true, alreadyPaid: true, bookingRef }
    }

    const chargeUsdCents = booking.charged_usd_cents ?? xcdCentsToUsdCents(booking.retail_price_xcd_cents)
    const savedRequestId = booking.go2pay_request_id ?? null
    const savedUrl = booking.go2pay_payment_url ?? null

    // STATE 1 — request id + url both persisted → reuse, never re-mint.
    if (savedUrl) {
      return { success: true, paymentUrl: savedUrl, bookingRef }
    }

    // STATE 2 — request claimed but url missing → recover it, never re-mint.
    if (savedRequestId) {
      const reqLookup = await getPaymentRequest(savedRequestId)
      const recoveredUrl =
        reqLookup.ok && reqLookup.data && typeof reqLookup.data.payment_url === 'string'
          ? reqLookup.data.payment_url
          : null

      if (!recoveredUrl) {
        console.error('[bikini-mix checkout] state2: payment_url not recoverable', JSON.stringify({ bookingId: booking.id }))
        setResponseStatus(event, 502)
        return { success: false, error: PAYMENT_INIT_ERROR }
      }

      const fin = await updateWithRetry(() =>
        supabase
          .from('bikini_mix_bookings')
          .update({ go2pay_payment_url: recoveredUrl })
          .eq('id', booking.id)
          .is('paid_at', null)
          .eq('go2pay_request_id', savedRequestId)
          .is('go2pay_payment_url', null)
          .select('id')
      )
      if (fin.error || !fin.data?.length) {
        const re = await supabase.from('bikini_mix_bookings').select('paid_at, go2pay_payment_url').eq('id', booking.id).maybeSingle()
        if (re.data?.paid_at) return { success: true, alreadyPaid: true, bookingRef }
        if (re.data?.go2pay_payment_url) return { success: true, paymentUrl: re.data.go2pay_payment_url, bookingRef }
        setResponseStatus(event, 502)
        return { success: false, error: PAYMENT_INIT_ERROR }
      }
      return { success: true, paymentUrl: recoveredUrl, bookingRef }
    }

    // STATE 3 — nothing persisted → create exactly one request, CLAIM, FINALIZE.
    let base
    try {
      base = siteUrl()
    } catch (err) {
      console.error('[bikini-mix checkout] site URL not configured:', err.message)
      setResponseStatus(event, 500)
      return { success: false, error: PAYMENT_INIT_ERROR }
    }

    let go2pay
    try {
      go2pay = await createPaymentRequest({
        name: `Bikini Mixer — ${PACKAGE_LABEL[booking.package] || booking.package}`,
        email: booking.email,
        phone: booking.whatsapp,
        amount: Number((chargeUsdCents / 100).toFixed(2)),
        description: `The Bikini Mixer booking ${bookingRef}`,
        endpoint: `${base}/api/payments/go2pay-bikini-mix/${booking.payment_callback_token}`,
        success_url: `${base}/bikini-mix/return?b=${encodeURIComponent(bookingRef)}&checkout=${encodeURIComponent(fields.checkoutIdempotencyKey)}`,
        error_url: `${base}/bikini-mix/cancelled`,
        send_email: false,
        send_receipt: true
      })
    } catch (err) {
      console.error('[bikini-mix checkout] Go2Pay create-request failed for booking', booking.id, '—', err.message)
      setResponseStatus(event, 502)
      return { success: false, error: PAYMENT_INIT_ERROR }
    }

    // CLAIM — guarantees a non-null request id is never overwritten.
    const claim = await updateWithRetry(() =>
      supabase
        .from('bikini_mix_bookings')
        .update({ go2pay_request_id: go2pay.id, charged_usd_cents: chargeUsdCents })
        .eq('id', booking.id)
        .is('paid_at', null)
        .is('go2pay_request_id', null)
        .select('id')
    )

    if (claim.error || !claim.data?.length) {
      console.error(
        '[bikini-mix checkout] CLAIM failed — orphan Go2Pay request',
        JSON.stringify({ bookingId: booking.id, go2payRequestId: go2pay.id, reason: claim.error?.message || '0-rows' })
      )
      const re = await supabase.from('bikini_mix_bookings').select('paid_at, go2pay_payment_url').eq('id', booking.id).maybeSingle()
      if (re.data?.paid_at) return { success: true, alreadyPaid: true, bookingRef }
      if (re.data?.go2pay_payment_url) return { success: true, paymentUrl: re.data.go2pay_payment_url, bookingRef }
      setResponseStatus(event, 502)
      return { success: false, error: PAYMENT_INIT_ERROR }
    }

    // FINALIZE — persist the URL for the request we just claimed.
    const fin = await updateWithRetry(() =>
      supabase
        .from('bikini_mix_bookings')
        .update({ go2pay_payment_url: go2pay.payment_url })
        .eq('id', booking.id)
        .is('paid_at', null)
        .eq('go2pay_request_id', go2pay.id)
        .is('go2pay_payment_url', null)
        .select('id')
    )

    if (fin.error || !fin.data?.length) {
      const re = await supabase.from('bikini_mix_bookings').select('paid_at, go2pay_payment_url').eq('id', booking.id).maybeSingle()
      if (re.data?.paid_at) return { success: true, alreadyPaid: true, bookingRef }
      if (re.data?.go2pay_payment_url) return { success: true, paymentUrl: re.data.go2pay_payment_url, bookingRef }
      console.error(
        '[bikini-mix checkout] FINALIZE failed — booking left recoverable (state 2)',
        JSON.stringify({ bookingId: booking.id, go2payRequestId: go2pay.id, err: fin.error?.message || '0-rows' })
      )
      setResponseStatus(event, 502)
      return { success: false, error: PAYMENT_INIT_ERROR }
    }

    return { success: true, paymentUrl: go2pay.payment_url, bookingRef }
  } catch (err) {
    console.error('[bikini-mix checkout] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { success: false, error: GENERIC_ERROR }
  }
})
