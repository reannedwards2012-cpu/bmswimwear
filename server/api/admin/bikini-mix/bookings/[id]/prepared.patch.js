/**
 * PATCH /api/admin/bikini-mix/bookings/:id/prepared
 *
 * Admin-only. Toggles whether this booking's physical bikini base has been
 * prepared — body: { prepared: boolean }. Deliberately a separate, tiny
 * endpoint from [id].patch.js (which handles payment/booking-status
 * resolution): base_prepared_at is a purely operational checklist flag,
 * never read by any payment, capacity, or booking-status logic.
 *
 * Only a 'confirmed' booking can be marked — a base is never "prepared"
 * for a booking that isn't a real confirmed guest (pending/needs-review/
 * cancelled/expired), matching the same scope as the Production Checklist
 * and the CSV export, which only ever show/list confirmed bookings.
 */
import { supabaseAdmin } from '../../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../../utils/authUser.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid booking id.' }
  }

  const body = await readBody(event).catch(() => null)
  if (typeof body?.prepared !== 'boolean') {
    setResponseStatus(event, 400)
    return { error: '"prepared" must be a boolean.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: current, error: findError } = await supabase.from('bikini_mix_bookings').select('id, status').eq('id', id).maybeSingle()
    if (findError) {
      console.error('[admin/bikini-mix/bookings/prepared] lookup failed:', findError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update preparation status.' }
    }
    if (!current) {
      setResponseStatus(event, 404)
      return { error: 'Booking not found.' }
    }
    if (current.status !== 'confirmed') {
      setResponseStatus(event, 409)
      return { error: 'Only a confirmed booking can be marked as prepared.' }
    }

    const { data, error } = await supabase
      .from('bikini_mix_bookings')
      .update({ base_prepared_at: body.prepared ? new Date().toISOString() : null })
      .eq('id', id)
      .eq('status', 'confirmed')
      .select('id, base_prepared_at')
      .maybeSingle()

    if (error || !data) {
      console.error('[admin/bikini-mix/bookings/prepared] update failed:', error?.message)
      setResponseStatus(event, 409)
      return { error: 'Could not update — this booking may have just changed. Please refresh and try again.' }
    }

    return { basePreparedAt: data.base_prepared_at }
  } catch (err) {
    console.error('[admin/bikini-mix/bookings/prepared] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update preparation status.' }
  }
})
