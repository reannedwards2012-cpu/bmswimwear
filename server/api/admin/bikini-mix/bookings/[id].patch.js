/**
 * PATCH /api/admin/bikini-mix/bookings/:id
 *
 * Admin-only resolution action — body: { resolution: 'confirm' | 'cancel', adminNotes? }.
 *
 * 'confirm' — ONLY valid on a 'paid_needs_review' booking (a payment that
 * verified after its hold expired, once the event was already at capacity —
 * see confirm_bikini_mix_booking_payment() in the migration). This is a
 * deliberate, explicit admin override granting an exception guest; it is
 * the ONLY path that moves a booking into 'confirmed' outside of the
 * capacity-checked payment flow itself, which is exactly why it requires a
 * human here rather than happening automatically.
 *
 * 'cancel' — valid from 'pending_payment', 'confirmed', or
 * 'paid_needs_review'. Records the decision; does NOT call any payment
 * provider refund API (none exists for Go2Pay here) — actual refund
 * processing per the approved policy happens manually, outside this system.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { validateBookingResolution } from '../../../../utils/bikiniMixValidation.js'
import { BOOKING_DETAIL_SELECT, mapBookingDetail } from '../../../../utils/bikiniMixMappers.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid booking id.' }
  }

  const body = await readBody(event).catch(() => null)
  const { issues, fields } = validateBookingResolution(body)
  if (issues.length) {
    setResponseStatus(event, 400)
    return { error: 'Invalid resolution.', issues }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: current, error: findError } = await supabase
      .from('bikini_mix_bookings')
      .select('id, status, admin_notes')
      .eq('id', id)
      .maybeSingle()
    if (findError) {
      console.error('[admin/bikini-mix/bookings] lookup failed:', findError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update booking.' }
    }
    if (!current) {
      setResponseStatus(event, 404)
      return { error: 'Booking not found.' }
    }

    const note = fields.adminNotes
      ? `${current.admin_notes ? current.admin_notes + '\n' : ''}[${admin.email}] ${fields.adminNotes}`
      : current.admin_notes

    if (fields.resolution === 'confirm') {
      if (current.status !== 'paid_needs_review') {
        setResponseStatus(event, 409)
        return { error: 'Only a booking flagged "paid, needs review" can be confirmed this way.' }
      }
      const { data, error } = await supabase
        .from('bikini_mix_bookings')
        .update({ status: 'confirmed', admin_notes: note, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'paid_needs_review')
        .select(BOOKING_DETAIL_SELECT)
        .maybeSingle()
      if (error || !data) {
        console.error('[admin/bikini-mix/bookings] confirm failed:', error?.message)
        setResponseStatus(event, 409)
        return { error: 'Could not confirm — this booking may have just changed. Please refresh and try again.' }
      }
      return { booking: mapBookingDetail(data) }
    }

    // resolution === 'cancel'
    if (!['pending_payment', 'confirmed', 'paid_needs_review'].includes(current.status)) {
      setResponseStatus(event, 409)
      return { error: 'This booking cannot be cancelled from its current status.' }
    }
    const { data, error } = await supabase
      .from('bikini_mix_bookings')
      .update({ status: 'cancelled', admin_notes: note, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', current.status)
      .select(BOOKING_DETAIL_SELECT)
      .maybeSingle()
    if (error || !data) {
      console.error('[admin/bikini-mix/bookings] cancel failed:', error?.message)
      setResponseStatus(event, 409)
      return { error: 'Could not cancel — this booking may have just changed. Please refresh and try again.' }
    }
    return { booking: mapBookingDetail(data) }
  } catch (err) {
    console.error('[admin/bikini-mix/bookings] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update booking.' }
  }
})
