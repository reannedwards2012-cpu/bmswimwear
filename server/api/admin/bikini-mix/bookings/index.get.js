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
import { isMigrationNotAppliedError } from '../../../../utils/bikiniMixMigrationGuard.js'

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
      if (isMigrationNotAppliedError(error)) {
        setResponseStatus(event, 503)
        return { configured: false, error: 'Swimsuit Mixer migration not applied yet.' }
      }
      console.error('[admin/bikini-mix/bookings] list failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load bookings.' }
    }

    let bookings = (data ?? []).map(mapBookingListItem)
    const garmentFilter = getQuery(event).garmentType
    if (typeof garmentFilter === 'string' && ['bikini', 'onepiece'].includes(garmentFilter)) {
      bookings = bookings.filter((b) => b.garmentType === garmentFilter)
    }
    if (typeof statusFilter === 'string' && VALID.includes(statusFilter)) {
      bookings = bookings.filter((b) => b.displayStatus === statusFilter)
    }

    const allMapped = (data ?? []).map(mapBookingListItem)
    const counts = { pending_payment: 0, confirmed: 0, paid_needs_review: 0, expired: 0, cancelled: 0 }
    for (const b of allMapped) {
      if (counts[b.displayStatus] != null) counts[b.displayStatus] += 1
    }

    // Early Bird sales visibility — confirmed+not-test rows only, mirroring
    // exactly what the RPC itself counts as "won" a slot.
    const earlyBird = {
      applied: allMapped.filter((b) => b.status === 'confirmed' && !b.isTest && b.earlyBirdApplied).length,
      mismatches: allMapped.filter((b) => b.earlyBirdMismatch).length
    }

    return { bookings, counts, earlyBird }
  } catch (err) {
    console.error('[admin/bikini-mix/bookings] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load bookings.' }
  }
})
