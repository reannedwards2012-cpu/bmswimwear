/**
 * GET /api/admin/bikini-mix/production-summary
 *
 * Admin-only. Two views over the same confirmed/non-test booking rows:
 *
 * 1. Grouped cutting/sewing quantities by garment component, size, fabric
 *    colour, style and coverage — e.g. "Pink left triangles, size M: 3",
 *    "Tie-Side bottoms, cheeky coverage, size M, red: 2" (brief's own
 *    examples) — for bulk cutting.
 * 2. A per-guest checklist row (one per booking) — for tracking which
 *    individual bases are physically prepared, via base_prepared_at
 *    (supabase/migrations/20261024000000_bikini_mix_base_prepared.sql) —
 *    a purely operational flag never read by any payment/capacity logic.
 *
 * Only status = 'confirmed' bookings contribute — NOT 'paid_needs_review'
 * (a verified payment that isn't a confirmed reservation yet; see the
 * migration's confirm_bikini_mix_booking_payment()), and not
 * 'pending_payment' / 'expired' / 'cancelled'. Also excludes is_test
 * bookings (server/utils/bikiniMixTestMode.js) — admin test runs must
 * never distort real cutting/sewing quantities or the checklist.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { formatBookingNumber } from '../../../utils/bikiniMixMappers.js'

function groupCount(rows, keyFn) {
  const totals = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (!key) continue
    const k = JSON.stringify(key)
    totals.set(k, { ...key, count: (totals.get(k)?.count ?? 0) + 1 })
  }
  return [...totals.values()].sort((a, b) => b.count - a.count)
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('bikini_mix_bookings')
      .select(
        'id, booking_number, full_name, package, top_size, left_fabric_name_snapshot, right_fabric_name_snapshot, bottom_style, bottom_coverage, bottom_size, bottom_fabric_name_snapshot, base_prepared_at'
      )
      .eq('status', 'confirmed')
      .eq('is_test', false)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[admin/bikini-mix/production-summary] query failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load production summary.' }
    }

    const rows = data ?? []

    const leftTriangles = groupCount(rows, (r) => ({ colour: r.left_fabric_name_snapshot, size: r.top_size }))
    const rightTriangles = groupCount(rows, (r) => ({ colour: r.right_fabric_name_snapshot, size: r.top_size }))
    const bottoms = groupCount(rows, (r) => ({
      style: r.bottom_style === 'tie-side' ? 'Tie-Side' : 'Classic',
      coverage: r.bottom_coverage === 'cheeky' ? 'Cheeky' : 'Bikini',
      size: r.bottom_size,
      colour: r.bottom_fabric_name_snapshot
    }))

    const bookings = rows.map((r) => ({
      id: r.id,
      bookingNumber: formatBookingNumber(r.booking_number),
      fullName: r.full_name,
      package: r.package === 'the_works' ? 'The Works' : 'Classic Mix',
      topSize: r.top_size,
      leftFabricName: r.left_fabric_name_snapshot,
      rightFabricName: r.right_fabric_name_snapshot,
      bottomStyle: r.bottom_style === 'tie-side' ? 'Tie-Side' : 'Classic',
      bottomCoverage: r.bottom_coverage === 'cheeky' ? 'Cheeky' : 'Bikini',
      bottomSize: r.bottom_size,
      bottomFabricName: r.bottom_fabric_name_snapshot,
      basePreparedAt: r.base_prepared_at
    }))

    return {
      confirmedCount: rows.length,
      leftTriangles,
      rightTriangles,
      bottoms,
      bookings
    }
  } catch (err) {
    console.error('[admin/bikini-mix/production-summary] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load production summary.' }
  }
})
