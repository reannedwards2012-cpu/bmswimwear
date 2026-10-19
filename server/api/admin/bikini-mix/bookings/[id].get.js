/**
 * GET /api/admin/bikini-mix/bookings/:id
 *
 * Admin-only. Full detail for one booking — every selection, contact
 * details, personalization, and payment/resolution state.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { BOOKING_DETAIL_SELECT, mapBookingDetail } from '../../../../utils/bikiniMixMappers.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid booking id.' }
  }

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('bikini_mix_bookings')
      .select(BOOKING_DETAIL_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[admin/bikini-mix/bookings] detail failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load booking.' }
    }
    if (!data) {
      setResponseStatus(event, 404)
      return { error: 'Booking not found.' }
    }

    return { booking: mapBookingDetail(data) }
  } catch (err) {
    console.error('[admin/bikini-mix/bookings] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load booking.' }
  }
})
