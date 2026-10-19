/**
 * POST /api/admin/bikini-mix/bookings/:id/resend-email
 *
 * Admin-only. Manually re-sends the booking confirmation email using the
 * booking's EXISTING details and selections — never creates a booking,
 * never touches payment/capacity, never calls Go2Pay or any RPC. Only for
 * bookings that are 'confirmed' AND payment-verified (paid_at set); a
 * 'paid_needs_review' booking isn't a real confirmation yet, so it's
 * explicitly refused here (the admin resolves it first via PATCH .../bookings/:id).
 *
 * This is a separate path from the automatic post-payment sender
 * (server/utils/bikiniMixBookingEmails.js) — that one is lease-protected
 * against concurrent Go2Pay callbacks; a manual admin click has no such
 * concurrent-webhook race, so it doesn't need the claim/lease dance. A
 * short cooldown (below) is the only duplicate-send guard needed here,
 * against an accidental double-click/double-submit.
 *
 * On success, bumps `paid_email_sent_at` to now — the admin UI shows this
 * as "last sent", true for both the original send and every resend.
 */
import { supabaseAdmin } from '../../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../../utils/authUser.js'
import { BOOKING_DETAIL_SELECT } from '../../../../../utils/bikiniMixMappers.js'
import { buildBookingView } from '../../../../../utils/bikiniMixBookingEmails.js'
import { bikiniMixBookingConfirmationEmail } from '../../../../../utils/emailTemplates.js'
import { sendTransactionalEmail } from '../../../../../utils/brevo.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COOLDOWN_MS = 10_000

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { success: false, error: 'Invalid booking id.' }
  }

  try {
    const supabase = supabaseAdmin()
    const [{ data: row, error }, { data: eventRow }] = await Promise.all([
      supabase.from('bikini_mix_bookings').select(BOOKING_DETAIL_SELECT).eq('id', id).maybeSingle(),
      supabase.from('bikini_mix_event').select('event_name, event_date, venue').eq('id', 'default').maybeSingle()
    ])

    if (error) {
      console.error('[admin/bikini-mix resend-email] lookup failed:', error.message)
      setResponseStatus(event, 500)
      return { success: false, error: 'Could not load booking.' }
    }
    if (!row) {
      setResponseStatus(event, 404)
      return { success: false, error: 'Booking not found.' }
    }
    if (row.status !== 'confirmed' || !row.paid_at) {
      setResponseStatus(event, 409)
      return { success: false, error: 'Only verified, confirmed bookings can have their confirmation email resent.' }
    }
    if (!row.email) {
      setResponseStatus(event, 409)
      return { success: false, error: 'This booking has no email address on file.' }
    }
    if (row.paid_email_sent_at && Date.now() - new Date(row.paid_email_sent_at).getTime() < COOLDOWN_MS) {
      setResponseStatus(event, 429)
      return { success: false, error: 'An email was just sent — please wait a moment before resending.' }
    }

    const view = buildBookingView(row, eventRow)
    const template = bikiniMixBookingConfirmationEmail(view)
    const res = await sendTransactionalEmail({
      to: row.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: ['bikini-mix-booking', 'resend']
    })

    if (!res.ok) {
      console.error('[admin/bikini-mix resend-email] send failed:', res.error)
      setResponseStatus(event, 502)
      return { success: false, error: 'Could not send the email. Please try again.' }
    }

    const sentAt = new Date().toISOString()
    const upd = await supabase.from('bikini_mix_bookings').update({ paid_email_sent_at: sentAt }).eq('id', id).select('id')

    if (upd.error) {
      console.error('[admin/bikini-mix resend-email] sent OK but failed to record sentAt:', upd.error.message)
    }

    return { success: true, sentAt }
  } catch (err) {
    console.error('[admin/bikini-mix resend-email] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { success: false, error: 'Could not send the email. Please try again.' }
  }
})
