/**
 * GET /api/admin/bikini-mix/production-summary
 *
 * Admin-only. Sewing/cutting quantities grouped by garment component, size,
 * fabric colour, style and coverage — e.g. "Pink left triangles, size M: 3",
 * "Tie-Side bottoms, cheeky coverage, size M, red: 2" (brief's own examples).
 *
 * Only status = 'confirmed' bookings contribute — NOT 'paid_needs_review'
 * (a verified payment that isn't a confirmed reservation yet; see the
 * migration's confirm_bikini_mix_booking_payment()), and not
 * 'pending_payment' / 'expired' / 'cancelled'. Also excludes is_test
 * bookings (server/utils/bikiniMixTestMode.js) — admin test runs must
 * never distort real cutting/sewing quantities.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'

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
        'top_size, left_fabric_name_snapshot, right_fabric_name_snapshot, bottom_style, bottom_coverage, bottom_size, bottom_fabric_name_snapshot'
      )
      .eq('status', 'confirmed')
      .eq('is_test', false)

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

    return {
      confirmedCount: rows.length,
      leftTriangles,
      rightTriangles,
      bottoms
    }
  } catch (err) {
    console.error('[admin/bikini-mix/production-summary] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load production summary.' }
  }
})
