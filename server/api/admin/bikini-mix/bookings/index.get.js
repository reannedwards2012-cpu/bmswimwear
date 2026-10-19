/**
 * GET /api/admin/bikini-mix/bookings
 *
 * Admin-only. Every booking, newest first. Optional ?status= filter — pass
 * the real status OR 'expired' (a display-only state computed from a
 * 'pending_payment' row whose hold has lapsed; see bikiniMixMappers.js).
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { BOOKING_LIST_SELECT, mapBookingListItem } from '../../../../utils/bikiniMixMappers.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const statusFilter = getQuery(event).status
  const VALID = ['pending_payment', 'confirmed', 'paid_needs_review', 'expired', 'cancelled']

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('bikini_mix_bookings')
      .select(BOOKING_LIST_SELECT)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[admin/bikini-mix/bookings] list failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load bookings.' }
    }

    let bookings = (data ?? []).map(mapBookingListItem)
    if (typeof statusFilter === 'string' && VALID.includes(statusFilter)) {
      bookings = bookings.filter((b) => b.displayStatus === statusFilter)
    }

    const counts = { pending_payment: 0, confirmed: 0, paid_needs_review: 0, expired: 0, cancelled: 0 }
    for (const b of (data ?? []).map(mapBookingListItem)) {
      if (counts[b.displayStatus] != null) counts[b.displayStatus] += 1
    }

    return { bookings, counts }
  } catch (err) {
    console.error('[admin/bikini-mix/bookings] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load bookings.' }
  }
})
