/**
 * Send the Bikini Mixer paid-booking emails — a customer confirmation (or
 * needs-review notice) and an admin notification — exactly once per booking,
 * safely under repeated and/or concurrent Go2Pay callbacks.
 *
 * Mirrors server/utils/paidOrderEmails.js's lease + durable-marker protocol
 * exactly, on bikini_mix_bookings.paid_email_sent_at / paid_email_claimed_at
 * (supabase/migrations/20261020000000_bikini_mix_payment_emails.sql).
 *
 * Called by server/api/payments/go2pay-bikini-mix/[token].post.js ONLY after
 * server/utils/bikiniMixPayments.js reports the booking verified paid
 * (outcome 'confirmed' or 'needs-review'; 'already-paid' re-enters here too
 * so a replayed callback still gets a chance to send if an earlier attempt's
 * lease was lost).
 */
import { formatBookingNumber, BOOKING_DETAIL_SELECT, mapBookingDetail } from './bikiniMixMappers.js'
import { sendTransactionalEmail } from './brevo.js'
import {
  bikiniMixBookingConfirmationEmail,
  bikiniMixBookingNeedsReviewEmail,
  bikiniMixBookingAdminEmail
} from './emailTemplates.js'
import { siteUrl } from './siteUrl.js'

const ADMIN_EMAIL = 'hello@bmswimwear.com'
const LEASE_MS = 3 * 60 * 1000

/**
 * @param supabase   service-role client
 * @param bookingId  the `bikini_mix_bookings.id` UUID
 */
export async function maybeSendBikiniMixBookingEmails(supabase, bookingId) {
  try {
    const leaseValue = new Date().toISOString()
    const leaseFloor = new Date(Date.now() - LEASE_MS).toISOString()

    // ── 1. CLAIM ─────────────────────────────────────────────────────────
    let claim = await supabase
      .from('bikini_mix_bookings')
      .update({ paid_email_claimed_at: leaseValue })
      .eq('id', bookingId)
      .not('paid_at', 'is', null)
      .is('paid_email_sent_at', null)
      .is('paid_email_claimed_at', null)
      .select('id')

    if (claim.error) {
      console.error('[bikini-mix paid-email] claim failed:', claim.error.message)
      return
    }

    if (!claim.data || !claim.data.length) {
      // Steal an expired claim (worker died mid-send).
      claim = await supabase
        .from('bikini_mix_bookings')
        .update({ paid_email_claimed_at: leaseValue })
        .eq('id', bookingId)
        .not('paid_at', 'is', null)
        .is('paid_email_sent_at', null)
        .lt('paid_email_claimed_at', leaseFloor)
        .select('id')

      if (claim.error) {
        console.error('[bikini-mix paid-email] expired-claim steal failed:', claim.error.message)
        return
      }
    }

    if (!claim.data || !claim.data.length) {
      // Already sent, or another worker holds a live lease.
      return
    }

    // ── 2. Load the booking + the event (for name/date/venue) ───────────
    const [{ data: booking, error: loadErr }, { data: eventRow }] = await Promise.all([
      supabase.from('bikini_mix_bookings').select(BOOKING_DETAIL_SELECT).eq('id', bookingId).maybeSingle(),
      supabase
        .from('bikini_mix_event')
        .select('event_name, event_date, venue')
        .eq('id', 'default')
        .maybeSingle()
    ])

    if (loadErr || !booking) {
      console.error('[bikini-mix paid-email] booking load failed:', (loadErr && loadErr.message) || 'not found')
      await releaseLease(supabase, bookingId, leaseValue)
      return
    }

    const view = buildBookingView(booking, eventRow)

    if (!booking.email) {
      console.error(`[bikini-mix paid-email] ${view.bookingRef} has no customer email — lease released`)
      await releaseLease(supabase, bookingId, leaseValue)
      return
    }

    // ── 3. Customer email — gates the durable marker ─────────────────────
    const custTemplate =
      view.status === 'confirmed' ? bikiniMixBookingConfirmationEmail(view) : bikiniMixBookingNeedsReviewEmail(view)
    const custRes = await sendTransactionalEmail({
      to: booking.email,
      subject: custTemplate.subject,
      html: custTemplate.html,
      text: custTemplate.text,
      tags: ['bikini-mix-booking']
    })

    if (!custRes.ok) {
      console.error(
        `[bikini-mix paid-email] customer email NOT sent for ${view.bookingRef} (${custRes.error}) — lease released, will retry on next callback`
      )
      await releaseLease(supabase, bookingId, leaseValue)
      return
    }

    // ── FINALIZE — durable + ownership-guarded, atomic ───────────────────
    const fin = await supabase
      .from('bikini_mix_bookings')
      .update({ paid_email_sent_at: new Date().toISOString(), paid_email_claimed_at: null })
      .eq('id', bookingId)
      .eq('paid_email_claimed_at', leaseValue)
      .is('paid_email_sent_at', null)
      .select('id')

    if (fin.error || !fin.data || !fin.data.length) {
      console.error(
        `[bikini-mix paid-email] customer email SENT for ${view.bookingRef} but finalize did not apply (${(fin.error && fin.error.message) || 'lease no longer owned'})`
      )
    }

    // ── 4. Admin notification — best-effort, gates nothing ───────────────
    let adminUrl = null
    try {
      adminUrl = `${siteUrl()}/admin/bikini-mix/bookings/${booking.id}`
    } catch {
      adminUrl = null
    }

    const adm = bikiniMixBookingAdminEmail(view, adminUrl)
    const admRes = await sendTransactionalEmail({
      to: ADMIN_EMAIL,
      subject: adm.subject,
      html: adm.html,
      text: adm.text,
      tags: ['bikini-mix-admin']
    })

    if (!admRes.ok) {
      console.error(
        `[bikini-mix paid-email] ADMIN notification failed for ${view.bookingRef} (${admRes.error}) — manual follow-up needed; customer email already sent`
      )
    }
  } catch (err) {
    console.error('[bikini-mix paid-email] unexpected error:', err && err.message)
  }
}

/** Clear our own lease so a later callback can retry — only if we still hold it. */
async function releaseLease(supabase, bookingId, leaseValue) {
  const r = await supabase
    .from('bikini_mix_bookings')
    .update({ paid_email_claimed_at: null })
    .eq('id', bookingId)
    .eq('paid_email_claimed_at', leaseValue)
    .is('paid_email_sent_at', null)
    .select('id')
  if (r.error) console.error('[bikini-mix paid-email] lease release failed:', r.error.message)
}

/** DB row (BOOKING_DETAIL_SELECT shape) + the event row → the view the templates consume. */
export function buildBookingView(row, eventRow) {
  const mapped = mapBookingDetail(row)
  return {
    bookingRef: formatBookingNumber(row.booking_number),
    fullName: mapped.fullName,
    email: mapped.email,
    package: mapped.package,
    retailPriceXcdCents: mapped.retailPriceXcdCents,
    chargedUsdCents: mapped.chargedUsdCents,
    topSize: mapped.topSize,
    bottomSize: mapped.bottomSize,
    leftFabricName: mapped.leftFabricName,
    rightFabricName: mapped.rightFabricName,
    bottomFabricName: mapped.bottomFabricName,
    bottomStyle: mapped.bottomStyle,
    bottomCoverage: mapped.bottomCoverage,
    personalizationName: mapped.personalizationName,
    status: row.status,
    eventName: eventRow?.event_name || 'The Bikini Mixer',
    eventDate: eventRow?.event_date || null,
    venue: eventRow?.venue || null
  }
}
