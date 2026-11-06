import { supabaseAdmin } from '../../utils/supabaseAdmin.js'
import { validateBookingCheckout } from '../../utils/bikiniMixValidation.js'
import { xcdCentsToUsdCents } from '../../utils/shipping.js'
import { createPaymentRequest, getPaymentRequest } from '../../utils/go2pay.js'
import { siteUrl } from '../../utils/siteUrl.js'
import { isHoneypotTripped } from '../../utils/inquiryValidation.js'
import { verifyTurnstileToken } from '../../utils/turnstile.js'
import { resolveClientIp, ipHash } from '../../utils/inquiryRateLimit.js'
import { checkRateLimit, recordRateHit } from '../../utils/checkoutRateLimit.js'

const GENERIC_ERROR = "We couldn't start your booking right now. Please try again."
const PAYMENT_INIT_ERROR = "We couldn't start payment right now. Please try again in a moment."
const VERIFICATION_ERROR = "We couldn't verify you're human — please try again."

const RATE_SCOPE = 'bikini-mix-checkout'
const RATE_WINDOW_MINUTES = 10
const RATE_MAX_PER_WINDOW = 8

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
 * NOTHING from the client is trusted for the price, the early-bird
 * decision, or fabric names/hex. Unlike before, the price is no longer
 * resolved here in application code at all — claim_bikini_mix_booking()
 * decides it internally (regular vs. early-bird, under the same row lock
 * that already serializes capacity), and this endpoint simply reads back
 * whatever the RPC authoritatively returns on the claimed row. Fabric
 * names/hex are still re-resolved from `fabrics` by id, exactly as before.
 *
 * Status stays 'pending_payment' until the Go2Pay callback
 * (server/api/payments/go2pay-bikini-mix/[token].post.js) independently
 * verifies and calls confirm_bikini_mix_booking_payment().
 *
 * Abuse protection, in order (Phase 1 security hardening) — none of it
 * changes payment verification or capacity decisions, which stay entirely
 * inside claim_bikini_mix_booking():
 *   1. Honeypot    — a filled hidden field => rejected, nothing claimed.
 *   2. Turnstile   — server-side token verification, same posture as
 *      server/api/inquiries.post.js (fails closed in production).
 *   3. Rate limit  — hashed-IP only, loose enough for a real retry.
 *   4. Early Bird per-IP slot-exhaustion guard — caps how many LIVE unpaid
 *      early-bird-quoted holds one source can have at once, so a script
 *      can't indefinitely occupy the 3-slot cap. Lives INSIDE
 *      claim_bikini_mix_booking() itself now (passed as p_client_ip_hash),
 *      under the same row lock as the global cap — a first implementation
 *      checked this in application code before calling the RPC, which had
 *      a check-then-act race under true concurrency; moving it inside the
 *      lock closes that race completely. See the migration's banner
 *      comment (supabase/migrations/20261106000000_checkout_abuse_protection.sql)
 *      for the full design. Exceeding the cap never rejects the booking —
 *      it just downgrades this claim to the regular price, same as the
 *      global cap, which the existing "Guarantee 2" frontend flow already
 *      handles by asking the customer to confirm before paying more than
 *      they expected.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null)

  // 1. Honeypot — a filled hidden field is never a real guest.
  if (isHoneypotTripped(body)) {
    setResponseStatus(event, 400)
    return { success: false, error: GENERIC_ERROR }
  }

  const { issues, fields } = validateBookingCheckout(body)
  if (issues.length) {
    setResponseStatus(event, 400)
    return { success: false, error: issues[0], issues }
  }

  // 2. Turnstile — verified before any hold is claimed or Go2Pay request
  //    initiated. Same module/posture as server/api/inquiries.post.js.
  const clientIp = resolveClientIp(event)
  const turnstileResult = await verifyTurnstileToken(body?.turnstileToken, clientIp)
  if (!turnstileResult.ok) {
    setResponseStatus(event, 400)
    return { success: false, error: VERIFICATION_ERROR, reason: turnstileResult.reason }
  }

  try {
    const supabase = supabaseAdmin()

    // 3. Rate limit (DB-backed, hashed-IP only) — loose enough that a real
    //    guest retrying payment never trips it.
    const ipHashValue = ipHash(clientIp)
    const gate = await checkRateLimit(supabase, {
      scope: RATE_SCOPE,
      keyHash: ipHashValue,
      windowMinutes: RATE_WINDOW_MINUTES,
      maxPerWindow: RATE_MAX_PER_WINDOW
    })
    if (!gate.ok) {
      setResponseStatus(event, 429)
      setResponseHeader(event, 'Retry-After', String(gate.retryAfterSeconds))
      return { success: false, error: 'Too many attempts — please wait a few minutes and try again.' }
    }
    await recordRateHit(supabase, { scope: RATE_SCOPE, keyHash: ipHashValue })

    // ── Authoritative fabric resolution — never trust the client ──
    const isBikini = fields.garmentType === 'bikini'
    const fabricIds = isBikini
      ? [fields.leftFabricId, fields.rightFabricId, fields.bottomFabricId]
      : [fields.onepieceFabricId]

    const { data: fabricRows, error: fabricErr } = await supabase
      .from('fabrics')
      .select('id, name, hex_color, is_active, status')
      .in('id', fabricIds)

    if (fabricErr) {
      console.error('[bikini-mix checkout] fabric lookup failed:', fabricErr.message)
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
        return { success: false, error: 'One of the selected fabrics is no longer available. Please go back and choose again.' }
      }
    } else {
      onepiece = fabricById.get(fields.onepieceFabricId)
      if (!fabricOk(onepiece)) {
        setResponseStatus(event, 400)
        return { success: false, error: 'The selected fabric is no longer available. Please go back and choose again.' }
      }
      // A one-piece fabric must be specifically opted in for one-pieces —
      // checked server-side, never trusted from the client-side filter
      // alone (the brief's "do not assume every bikini fabric is
      // available for one-pieces").
      const { data: linkRow, error: linkErr } = await supabase
        .from('bikini_mix_fabrics')
        .select('eligible_for_onepiece')
        .eq('fabric_id', fields.onepieceFabricId)
        .maybeSingle()
      if (linkErr) {
        console.error('[bikini-mix checkout] one-piece eligibility lookup failed:', linkErr.message)
        setResponseStatus(event, 500)
        return { success: false, error: GENERIC_ERROR }
      }
      if (!linkRow?.eligible_for_onepiece) {
        setResponseStatus(event, 400)
        return { success: false, error: 'That fabric is not available for one-pieces. Please choose another.' }
      }
    }

    // ── Claim the hold (or reuse an existing one — idempotent). Price and
    // the early-bird decision are both decided INSIDE this RPC, under the
    // bikini_mix_event row lock — never here in application code. ──
    const { data: booking, error: claimErr } = await supabase.rpc('claim_bikini_mix_booking', {
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
      p_terms_accepted_at: new Date().toISOString(),
      p_client_ip_hash: ipHashValue
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

    // Measurements are purely informational (never read by payment/capacity/
    // concurrency logic), so this is a best-effort update outside the claim
    // RPC's lock — always reflects the latest submission, never blocks or
    // fails the checkout if it errors (e.g. the migration adding these
    // columns isn't applied yet).
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
      if (measurementsErr) console.error('[bikini-mix checkout] could not save measurements:', measurementsErr.message)
    }

    const bookingRef = `BKM-${String(booking.booking_number).padStart(6, '0')}`
    // The true, reservation-backed price/tier — read back from the RPC's
    // result, never computed here. The frontend compares this against what
    // it displayed before the click (Guarantee 2 in the implementation
    // plan) and asks for explicit confirmation before redirecting to
    // Go2Pay if early-bird pricing was expected but is no longer available.
    const isEarlyBird = booking.early_bird_quoted === true
    const retailPriceXcdCents = booking.retail_price_xcd_cents

    if (booking.paid_at) {
      return { success: true, alreadyPaid: true, bookingRef, isEarlyBird, retailPriceXcdCents }
    }

    const chargeUsdCents = booking.charged_usd_cents ?? xcdCentsToUsdCents(booking.retail_price_xcd_cents)
    const savedRequestId = booking.go2pay_request_id ?? null
    const savedUrl = booking.go2pay_payment_url ?? null

    // STATE 1 — request id + url both persisted → reuse, never re-mint.
    if (savedUrl) {
      return { success: true, paymentUrl: savedUrl, bookingRef, isEarlyBird, retailPriceXcdCents }
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
        if (re.data?.paid_at) return { success: true, alreadyPaid: true, bookingRef, isEarlyBird, retailPriceXcdCents }
        if (re.data?.go2pay_payment_url) return { success: true, paymentUrl: re.data.go2pay_payment_url, bookingRef, isEarlyBird, retailPriceXcdCents }
        setResponseStatus(event, 502)
        return { success: false, error: PAYMENT_INIT_ERROR }
      }
      return { success: true, paymentUrl: recoveredUrl, bookingRef, isEarlyBird, retailPriceXcdCents }
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
        name: `The Swimsuit Mixer — ${isEarlyBird ? 'Early Bird Ticket' : 'Ticket'}`,
        email: booking.email,
        phone: booking.whatsapp,
        amount: Number((chargeUsdCents / 100).toFixed(2)),
        description: `The Swimsuit Mixer booking ${bookingRef}`,
        endpoint: `${base}/api/payments/go2pay-bikini-mix/${booking.payment_callback_token}`,
        success_url: `${base}/swimsuit-mixer/return?b=${encodeURIComponent(bookingRef)}&checkout=${encodeURIComponent(fields.checkoutIdempotencyKey)}`,
        error_url: `${base}/swimsuit-mixer/cancelled`,
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
      if (re.data?.paid_at) return { success: true, alreadyPaid: true, bookingRef, isEarlyBird, retailPriceXcdCents }
      if (re.data?.go2pay_payment_url) return { success: true, paymentUrl: re.data.go2pay_payment_url, bookingRef, isEarlyBird, retailPriceXcdCents }
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
      if (re.data?.paid_at) return { success: true, alreadyPaid: true, bookingRef, isEarlyBird, retailPriceXcdCents }
      if (re.data?.go2pay_payment_url) return { success: true, paymentUrl: re.data.go2pay_payment_url, bookingRef, isEarlyBird, retailPriceXcdCents }
      console.error(
        '[bikini-mix checkout] FINALIZE failed — booking left recoverable (state 2)',
        JSON.stringify({ bookingId: booking.id, go2payRequestId: go2pay.id, err: fin.error?.message || '0-rows' })
      )
      setResponseStatus(event, 502)
      return { success: false, error: PAYMENT_INIT_ERROR }
    }

    return { success: true, paymentUrl: go2pay.payment_url, bookingRef, isEarlyBird, retailPriceXcdCents }
  } catch (err) {
    console.error('[bikini-mix checkout] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { success: false, error: GENERIC_ERROR }
  }
})
