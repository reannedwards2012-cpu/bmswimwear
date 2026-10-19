import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { validateBookingCheckout } from '../../../utils/bikiniMixValidation.js'
import { createPaymentRequest, getPaymentRequest } from '../../../utils/go2pay.js'
import { siteUrl } from '../../../utils/siteUrl.js'
import { TEST_CHARGE_USD_CENTS, TEST_BOOKING_NAME_PREFIX } from '../../../utils/bikiniMixTestMode.js'

const GENERIC_ERROR = "We couldn't start the test booking right now. Please try again."
const PAYMENT_INIT_ERROR = "We couldn't start test payment right now. Please try again in a moment."

const PACKAGE_LABEL = { classic_mix: 'Classic Mix', the_works: 'The Works' }

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
 *   - requireAdmin() gates the whole request (throws 401/403 otherwise —
 *     the real public endpoint has no such gate and never will).
 *   - Calls claim_bikini_mix_booking_test() instead of
 *     claim_bikini_mix_booking(), which bypasses only is_bookings_open /
 *     booking_deadline — every other check (capacity, idempotency,
 *     package validity) is identical.
 *   - The amount actually charged to Go2Pay is the fixed
 *     TEST_CHARGE_USD_CENTS, never the real event price — retail_price_xcd_cents
 *     is still the real package price, purely for realistic display on the
 *     review screen and in the confirmation email.
 *   - Go2Pay request name/description are prefixed "[TEST]" so it's
 *     unmistakable in the Go2Pay dashboard too.
 * Payment verification itself (the callback + server/utils/bikiniMixPayments.js)
 * is completely unchanged and unaware this is a test — a test booking's
 * payment is verified exactly as rigorously as a real one.
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
      console.error('[bikini-mix test-checkout] event lookup failed:', eventErr?.message || 'not found')
      setResponseStatus(event, 500)
      return { success: false, error: GENERIC_ERROR }
    }
    if (fabricErr) {
      console.error('[bikini-mix test-checkout] fabric lookup failed:', fabricErr.message)
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
      return { success: false, error: 'One of the selected fabrics is no longer available.' }
    }

    const retailPriceXcdCents =
      fields.package === 'the_works' ? eventRow.the_works_price_xcd_cents : eventRow.classic_mix_price_xcd_cents

    const { data: booking, error: claimErr } = await supabase.rpc('claim_bikini_mix_booking_test', {
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
        return { success: false, error: claimErr.message || 'Event is fully booked.' }
      }
      console.error('[bikini-mix test-checkout] claim failed:', claimErr?.message)
      setResponseStatus(event, 500)
      return { success: false, error: GENERIC_ERROR }
    }

    const bookingRef = `BKM-${String(booking.booking_number).padStart(6, '0')}`

    if (booking.paid_at) {
      return { success: true, alreadyPaid: true, bookingRef, isTest: true }
    }

    const chargeUsdCents = booking.charged_usd_cents ?? TEST_CHARGE_USD_CENTS
    const savedRequestId = booking.go2pay_request_id ?? null
    const savedUrl = booking.go2pay_payment_url ?? null

    if (savedUrl) {
      return { success: true, paymentUrl: savedUrl, bookingRef, isTest: true }
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
        if (re.data?.paid_at) return { success: true, alreadyPaid: true, bookingRef, isTest: true }
        if (re.data?.go2pay_payment_url) return { success: true, paymentUrl: re.data.go2pay_payment_url, bookingRef, isTest: true }
        setResponseStatus(event, 502)
        return { success: false, error: PAYMENT_INIT_ERROR }
      }
      return { success: true, paymentUrl: recoveredUrl, bookingRef, isTest: true }
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
        name: `${TEST_BOOKING_NAME_PREFIX} Bikini Mixer — ${PACKAGE_LABEL[booking.package] || booking.package}`,
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
      if (re.data?.paid_at) return { success: true, alreadyPaid: true, bookingRef, isTest: true }
      if (re.data?.go2pay_payment_url) return { success: true, paymentUrl: re.data.go2pay_payment_url, bookingRef, isTest: true }
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
      if (re.data?.paid_at) return { success: true, alreadyPaid: true, bookingRef, isTest: true }
      if (re.data?.go2pay_payment_url) return { success: true, paymentUrl: re.data.go2pay_payment_url, bookingRef, isTest: true }
      setResponseStatus(event, 502)
      return { success: false, error: PAYMENT_INIT_ERROR }
    }

    return { success: true, paymentUrl: go2pay.payment_url, bookingRef, isTest: true }
  } catch (err) {
    console.error('[bikini-mix test-checkout] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { success: false, error: GENERIC_ERROR }
  }
})
