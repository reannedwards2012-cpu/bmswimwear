/**
 * GET /api/admin/bikini-mix/bookings/export
 *
 * Admin-only. CSV of every CONFIRMED, non-test booking — the same scope as
 * the Production Checklist/Summary (status = 'confirmed', is_test = false;
 * a 'paid_needs_review' booking is deliberately excluded until an admin
 * resolves it, same rule as production-summary.get.js). Read-only: touches
 * no payment, capacity, or booking-status logic.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { formatBookingNumber } from '../../../../utils/bikiniMixMappers.js'

const COLUMNS = [
  'Booking Reference',
  'Customer Name',
  'Email',
  'WhatsApp',
  'Package',
  'Top Size',
  'Left Triangle Fabric',
  'Right Triangle Fabric',
  'Bottom Size',
  'Bottom Fabric',
  'Bottom Style',
  'Coverage',
  'Personalization Name',
  'Amount Paid (USD)',
  'Booking Date'
]

/** Standard CSV field escaping: quote + double-up internal quotes whenever a comma, quote, or newline is present. */
function csvField(value) {
  const s = value == null ? '' : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function csvRow(values) {
  return values.map(csvField).join(',') + '\r\n'
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('bikini_mix_bookings')
      .select(
        'booking_number, full_name, email, whatsapp, package, top_size, left_fabric_name_snapshot, right_fabric_name_snapshot, bottom_size, bottom_fabric_name_snapshot, bottom_style, bottom_coverage, personalization_name, charged_usd_cents, created_at'
      )
      .eq('status', 'confirmed')
      .eq('is_test', false)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[admin/bikini-mix/bookings/export] query failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not export bookings.' }
    }

    const rows = (data ?? []).map((r) => [
      formatBookingNumber(r.booking_number),
      r.full_name || '',
      r.email || '',
      r.whatsapp || '',
      r.package === 'the_works' ? 'The Works' : 'Classic Mix',
      r.top_size || '',
      r.left_fabric_name_snapshot || '',
      r.right_fabric_name_snapshot || '',
      r.bottom_size || '',
      r.bottom_fabric_name_snapshot || '',
      r.bottom_style === 'tie-side' ? 'Tie-Side' : 'Classic',
      r.bottom_coverage === 'cheeky' ? 'Cheeky' : 'Bikini',
      r.personalization_name || '',
      r.charged_usd_cents != null ? (r.charged_usd_cents / 100).toFixed(2) : '',
      r.created_at ? r.created_at.slice(0, 10) : ''
    ])

    const csv = csvRow(COLUMNS) + rows.map(csvRow).join('')

    setResponseHeaders(event, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bikini-mix-bookings-${new Date().toISOString().slice(0, 10)}.csv"`
    })
    return csv
  } catch (err) {
    console.error('[admin/bikini-mix/bookings/export] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not export bookings.' }
  }
})
