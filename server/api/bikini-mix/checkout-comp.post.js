import { supabaseAdmin } from '../../utils/supabaseAdmin.js'
import { validateBookingCheckout, validateInvitationCodeInput } from '../../utils/bikiniMixValidation.js'
import { codeHash } from '../../utils/bikiniMixInvitationCodes.js'
import { isHoneypotTripped } from '../../utils/inquiryValidation.js'
import { verifyTurnstileToken } from '../../utils/turnstile.js'
import { resolveClientIp, ipHash } from '../../utils/inquiryRateLimit.js'
import { checkRateLimit, recordRateHit } from '../../utils/checkoutRateLimit.js'
import { maybeSendBikiniMixBookingEmails } from '../../utils/bikiniMixBookingEmails.js'

const GENERIC_ERROR = "We couldn't complete your registration right now. Please try again."
const INVALID_CODE_ERROR = 'That invitation code is invalid, expired, or has already been used.'
const VERIFICATION_ERROR = "We couldn't verify you're human — please try again."

const RATE_SCOPE = 'bikini-mix-checkout-comp'
const RATE_WINDOW_MINUTES = 10
const RATE_MAX_PER_WINDOW = 8

/**
 * POST /api/bikini-mix/checkout-comp
 *
 * The ONLY way a complimentary booking is created. A sibling of
 * server/api/bikini-mix/checkout.post.js, not a modification of it — the
 * real paid endpoint is completely untouched by this file's existence.
 *
 * Same abuse-protection layering as the paid endpoint (honeypot →
 * Turnstile → rate limit), plus the code itself: hashed here, then handed
 * to claim_bikini_mix_comp_booking(), which is the only thing that can
 * ever atomically validate-and-redeem it (row-locked on the code, so two
 * simultaneous redemption attempts of the same code can never both
 * succeed — see the migration's banner comment). A query parameter alone
 * can never reach this path to a free booking: `code` is required,
 * non-empty, and is independently re-validated/hashed/looked-up here no
 * matter what a client claims about it.
 *
 * On success, the booking is inserted ALREADY `status='confirmed'` with
 * `paid_at` set (there is no payment to wait for) — no Go2Pay request is
 * ever created, no hold/pending state ever exists for this booking. The
 * response is deliberately shaped like the paid endpoint's `alreadyPaid`
 * case ({success, alreadyPaid:true, bookingRef}) so the frontend's
 * existing `if (res.alreadyPaid) navigateTo(...)` branch handles this with
 * no new response-shape handling.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null)

  if (isHoneypotTripped(body)) {
    setResponseStatus(event, 400)
    return { success: false, error: GENERIC_ERROR }
  }

  const { issues: codeIssues, code } = validateInvitationCodeInput(body)
  const { issues, fields } = validateBookingCheckout(body)
  const allIssues = [...codeIssues, ...issues]
  if (allIssues.length) {
    setResponseStatus(event, 400)
    return { success: false, error: allIssues[0], issues: allIssues }
  }

  const clientIp = resolveClientIp(event)
  const turnstileResult = await verifyTurnstileToken(body?.turnstileToken, clientIp)
  if (!turnstileResult.ok) {
    setResponseStatus(event, 400)
    return { success: false, error: VERIFICATION_ERROR, reason: turnstileResult.reason }
  }

  try {
    const supabase = supabaseAdmin()

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

    const hash = codeHash(code)
    if (!hash) {
      console.error('[bikini-mix checkout-comp] codeHash() returned null — INQUIRY_HASH_SECRET missing?')
      setResponseStatus(event, 500)
      return { success: false, error: GENERIC_ERROR }
    }

    // ── Authoritative fabric resolution — identical to checkout.post.js ──
    const isBikini = fields.garmentType === 'bikini'
    const fabricIds = isBikini
      ? [fields.leftFabricId, fields.rightFabricId, fields.bottomFabricId]
      : [fields.onepieceFabricId]

    const { data: fabricRows, error: fabricErr } = await supabase
      .from('fabrics')
      .select('id, name, hex_color, is_active, status')
      .in('id', fabricIds)

    if (fabricErr) {
      console.error('[bikini-mix checkout-comp] fabric lookup failed:', fabricErr.message)
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
      const { data: linkRow, error: linkErr } = await supabase
        .from('bikini_mix_fabrics')
        .select('eligible_for_onepiece')
        .eq('fabric_id', fields.onepieceFabricId)
        .maybeSingle()
      if (linkErr) {
        console.error('[bikini-mix checkout-comp] one-piece eligibility lookup failed:', linkErr.message)
        setResponseStatus(event, 500)
        return { success: false, error: GENERIC_ERROR }
      }
      if (!linkRow?.eligible_for_onepiece) {
        setResponseStatus(event, 400)
        return { success: false, error: 'That fabric is not available for one-pieces. Please choose another.' }
      }
    }

    const { data: booking, error: claimErr } = await supabase.rpc('claim_bikini_mix_comp_booking', {
      p_checkout_idempotency_key: fields.checkoutIdempotencyKey,
      p_code_hash: hash,
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
      const code2 = claimErr?.code
      if (code2 === '22023' || code2 === '55000') {
        setResponseStatus(event, 409)
        return { success: false, error: INVALID_CODE_ERROR }
      }
      console.error('[bikini-mix checkout-comp] claim failed:', claimErr?.message)
      setResponseStatus(event, 500)
      return { success: false, error: GENERIC_ERROR }
    }

    // Measurements — same best-effort, non-blocking save as checkout.post.js.
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
      if (measurementsErr) console.error('[bikini-mix checkout-comp] could not save measurements:', measurementsErr.message)
    }

    const bookingRef = `BKM-${String(booking.booking_number).padStart(6, '0')}`

    // No Go2Pay callback will ever fire for this booking — the
    // confirmation email is sent directly, right here, the one and only
    // time this booking will ever become "paid" (confirmed).
    await maybeSendBikiniMixBookingEmails(supabase, booking.id).catch((e) =>
      console.error('[bikini-mix checkout-comp] email dispatch error:', e?.message)
    )

    return { success: true, alreadyPaid: true, bookingRef, isComplimentary: true }
  } catch (err) {
    console.error('[bikini-mix checkout-comp] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { success: false, error: GENERIC_ERROR }
  }
})
