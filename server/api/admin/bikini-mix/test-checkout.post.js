import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { validateBookingCheckout } from '../../../utils/bikiniMixValidation.js'
import { createPaymentRequest, getPaymentRequest } from '../../../utils/go2pay.js'
import { siteUrl } from '../../../utils/siteUrl.js'
import { TEST_CHARGE_USD_CENTS, TEST_BOOKING_NAME_PREFIX } from '../../../utils/bikiniMixTestMode.js'

const GENERIC_ERROR = "We couldn't start the test booking right now. Please try again."
const PAYMENT_INIT_ERROR = "We couldn't start test payment right now. Please try again in a moment."

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
 * POST /api/admin/bikini-mix/test-checkout
 *
 * Admin-only mirror of POST /api/bikini-mix/checkout — see
 * server/utils/bikiniMixTestMode.js for the full design. The only
 * differences from the real endpoint:
 *   - requireAdmin() gates the whole request.
 *   - Calls claim_bikini_mix_booking_test() instead of
 *     claim_bikini_mix_booking(), which bypasses only is_bookings_open /
 *     booking_deadline — capacity AND early-bird reservation logic are
 *     identical, both already filtering `not is_test`.
 *   - The amount actually charged to Go2Pay is the fixed
 *     TEST_CHARGE_USD_CENTS, never the real early-bird/regular price —
 *     retail_price_xcd_cents is still the real reserved price, purely for
 *     realistic display on the review screen and in the confirmation email.
 *   - Go2Pay request name/description are prefixed "[TEST]".
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const { issues, fields } = validateBookingCheckout(body)
  if (issues.length) {
    setResponseStatus(event, 400)
    return { success: false, error: issues[0], issues }
  }

  try {
    const supabase = supabaseAdmin()

    const isBikini = fields.garmentType === 'bikini'
    const fabricIds = isBikini
      ? [fields.leftFabricId, fields.rightFabricId, fields.bottomFabricId]
      : [fields.onepieceFabricId]

    const { data: fabricRows, error: fabricErr } = await supabase
      .from('fabrics')
      .select('id, name, hex_color, is_active, status')
      .in('id', fabricIds)

    if (fabricErr) {
      console.error('[bikini-mix test-checkout] fabric lookup failed:', fabricErr.message)
      setResponseStatus(event, 500)
      return { success: false, error: GENERIC_ERROR }
    }

    const fabricById = new Map((fabricRows ?? []).map((f) => [f.id, f]))
    const fabricOk = (f) => f && f.is_active && f.status !== 'unavailable'

    let left, right, bottom, onepiece
    if (isBikini) {
      left = fabricById.get(fields.leftFabricId)
      right = fabricById.get(fields.rightFabricId)
      bottom = fabricById.get(fields.bottomFabricId)
      if (!fabricOk(left) || !fabricOk(right) || !fabricOk(bottom)) {
        setResponseStatus(event, 400)
        return { success: false, error: 'One of the selected fabrics is no longer available.' }
      }
    } else {
      onepiece = fabricById.get(fields.onepieceFabricId)
      if (!fabricOk(onepiece)) {
        setResponseStatus(event, 400)
        return { success: false, error: 'The selected fabric is no longer available.' }
      }
      // Admin test mode exercises the same eligibility rule real customers
      // face, so it stays a faithful rehearsal of the real flow.
      const { data: linkRow, error: linkErr } = await supabase
        .from('bikini_mix_fabrics')
        .select('eligible_for_onepiece')
        .eq('fabric_id', fields.onepieceFabricId)
        .maybeSingle()
      if (linkErr) {
        console.error('[bikini-mix test-checkout] one-piece eligibility lookup failed:', linkErr.message)
        setResponseStatus(event, 500)
        return { success: false, error: GENERIC_ERROR }
      }
      if (!linkRow?.eligible_for_onepiece) {
        setResponseStatus(event, 400)
        return { success: false, error: 'That fabric is not available for one-pieces.' }
      }
    }

    const { data: booking, error: claimErr } = await supabase.rpc('claim_bikini_mix_booking_test', {
      p_checkout_idempotency_key: fields.checkoutIdempotencyKey,
      p_garment_type: fields.garmentType,
      p_top_size: fields.topSize,
      p_left_fabric_id: left?.id ?? null,
      p_left_fabric_name: left?.name ?? null,
      p_left_fabric_hex: left?.hex_color ?? null,
      p_right_fabric_id: right?.id ?? null,
      p_right_fabric_name: right?.name ?? null,
      p_right_fabric_hex: right?.hex_color ?? null,
      p_bottom_style: fields.bottomStyle,
      p_bottom_coverage: fields.bottomCoverage,
      p_bottom_size: fields.bottomSize,
      p_bottom_fabric_id: bottom?.id ?? null,
      p_bottom_fabric_name: bottom?.name ?? null,
      p_bottom_fabric_hex: bottom?.hex_color ?? null,
      p_bottom_scrunch: fields.bottomScrunch,
      p_onepiece_size: fields.onepieceSize,
      p_onepiece_coverage: fields.onepieceCoverage,
      p_onepiece_fabric_id: onepiece?.id ?? null,
      p_onepiece_fabric_name: onepiece?.name ?? null,
      p_onepiece_fabric_hex: onepiece?.hex_color ?? null,
      p_full_name: fields.fullName,
      p_email: fields.email,
      p_whatsapp: fields.whatsapp,
      p_marketing_opt_in: fields.marketingOptIn,
      p_terms_accepted_at: new Date().toISOString()
    })

    if (claimErr || !booking) {
      const code = claimErr?.code
      if (code === '55000') {
        setResponseStatus(event, 409)
        return { success: false, error: claimErr.message || 'Event is fully booked.' }
      }
      console.error('[bikini-mix test-checkout] claim failed:', claimErr?.message)
      setResponseStatus(event, 500)
      return { success: false, error: GENERIC_ERROR }
    }

    // Same best-effort, non-blocking measurements save as the real checkout
    // endpoint (server/api/bikini-mix/checkout.post.js) — see its comment.
    const hasMeasurements = [fields.bustInches, fields.underbustInches, fields.waistInches, fields.hipsInches].some((v) => v != null)
    if (hasMeasurements) {
      const { error: measurementsErr } = await supabase
        .from('bikini_mix_bookings')
        .update({
          bust_inches: fields.bustInches,
          underbust_inches: fields.underbustInches,
          waist_inches: fields.waistInches,
          hips_inches: fields.hipsInches
        })
        .eq('id', booking.id)
      if (measurementsErr) console.error('[bikini-mix test-checkout] could not save measurements:', measurementsErr.message)
    }

    const bookingRef = `BKM-${String(booking.booking_number).padStart(6, '0')}`
    const isEarlyBird = booking.early_bird_quoted === true
    const retailPriceXcdCents = booking.retail_price_xcd_cents

    if (booking.paid_at) {
      return { success: true, alreadyPaid: true, bookingRef, isTest: true, isEarlyBird, retailPriceXcdCents }
    }

    const chargeUsdCents = booking.charged_usd_cents ?? TEST_CHARGE_USD_CENTS
    const savedRequestId = booking.go2pay_request_id ?? null
    const savedUrl = booking.go2pay_payment_url ?? null

    if (savedUrl) {
      return { success: true, paymentUrl: savedUrl, bookingRef, isTest: true, isEarlyBird, retailPriceXcdCents }
    }

    if (savedRequestId) {
      const reqLookup = await getPaymentRequest(savedRequestId)
      const recoveredUrl =
        reqLookup.ok && reqLookup.data && typeof reqLookup.data.payment_url === 'string'
          ? reqLookup.data.payment_url
          : null
      if (!recoveredUrl) {
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
        if (re.data?.paid_at) return { success: true, alreadyPaid: true, bookingRef, isTest: true, isEarlyBird, retailPriceXcdCents }
        if (re.data?.go2pay_payment_url) return { success: true, paymentUrl: re.data.go2pay_payment_url, bookingRef, isTest: true, isEarlyBird, retailPriceXcdCents }
        setResponseStatus(event, 502)
        return { success: false, error: PAYMENT_INIT_ERROR }
      }
      return { success: true, paymentUrl: recoveredUrl, bookingRef, isTest: true, isEarlyBird, retailPriceXcdCents }
    }

    let base
    try {
      base = siteUrl()
    } catch (err) {
      console.error('[bikini-mix test-checkout] site URL not configured:', err.message)
      setResponseStatus(event, 500)
      return { success: false, error: PAYMENT_INIT_ERROR }
    }

    let go2pay
    try {
      go2pay = await createPaymentRequest({
        name: `${TEST_BOOKING_NAME_PREFIX} The Swimsuit Mixer — ${isEarlyBird ? 'Early Bird Ticket' : 'Ticket'}`,
        email: booking.email,
        phone: booking.whatsapp,
        amount: Number((chargeUsdCents / 100).toFixed(2)),
        description: `${TEST_BOOKING_NAME_PREFIX} admin test booking ${bookingRef} — not a real guest`,
        endpoint: `${base}/api/payments/go2pay-bikini-mix/${booking.payment_callback_token}`,
        success_url: `${base}/bikini-mix/return?b=${encodeURIComponent(bookingRef)}&checkout=${encodeURIComponent(fields.checkoutIdempotencyKey)}&test=1`,
        error_url: `${base}/bikini-mix/cancelled?test=1`,
        send_email: false,
        send_receipt: true
      })
    } catch (err) {
      console.error('[bikini-mix test-checkout] Go2Pay create-request failed for booking', booking.id, '—', err.message)
      setResponseStatus(event, 502)
      return { success: false, error: PAYMENT_INIT_ERROR }
    }

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
      console.error('[bikini-mix test-checkout] CLAIM failed — orphan Go2Pay request', JSON.stringify({ bookingId: booking.id, go2payRequestId: go2pay.id }))
      const re = await supabase.from('bikini_mix_bookings').select('paid_at, go2pay_payment_url').eq('id', booking.id).maybeSingle()
      if (re.data?.paid_at) return { success: true, alreadyPaid: true, bookingRef, isTest: true, isEarlyBird, retailPriceXcdCents }
      if (re.data?.go2pay_payment_url) return { success: true, paymentUrl: re.data.go2pay_payment_url, bookingRef, isTest: true, isEarlyBird, retailPriceXcdCents }
      setResponseStatus(event, 502)
      return { success: false, error: PAYMENT_INIT_ERROR }
    }

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
      if (re.data?.paid_at) return { success: true, alreadyPaid: true, bookingRef, isTest: true, isEarlyBird, retailPriceXcdCents }
      if (re.data?.go2pay_payment_url) return { success: true, paymentUrl: re.data.go2pay_payment_url, bookingRef, isTest: true, isEarlyBird, retailPriceXcdCents }
      setResponseStatus(event, 502)
      return { success: false, error: PAYMENT_INIT_ERROR }
    }

    return { success: true, paymentUrl: go2pay.payment_url, bookingRef, isTest: true, isEarlyBird, retailPriceXcdCents }
  } catch (err) {
    console.error('[bikini-mix test-checkout] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { success: false, error: GENERIC_ERROR }
  }
})
