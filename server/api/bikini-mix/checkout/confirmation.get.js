import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { BOOKING_DETAIL_SELECT, mapBookingDetail } from '../../../utils/bikiniMixMappers.js'

/**
 * GET /api/bikini-mix/checkout/confirmation?checkout=<uuid>
 *
 * The full booking-confirmation view for pages/bikini-mix/return.vue —
 * booking reference, guest name, package, bikini selections, event details,
 * payment info. Keyed by the client-held `checkout_idempotency_key` (the
 * same random UUID the browser generated at Build time, held in
 * sessionStorage — see composables/useBikiniMixCheckout.js), never by
 * booking_number, and returns data ONLY once payment is verified
 * (paid_at set) — so a booking confirmation can never be reached by
 * guessing a URL, only by the browser that actually created and paid for
 * it. A pending/unverified booking gets the same {found:false} shape as a
 * booking that doesn't exist at all.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const checkoutId = norm(getQuery(event).checkout)
  if (!UUID_RE.test(checkoutId)) {
    setResponseStatus(event, 400)
    return { found: false }
  }

  try {
    const supabase = supabaseAdmin()
    const [{ data: row, error }, { data: eventRow }] = await Promise.all([
      supabase
        .from('bikini_mix_bookings')
        .select(BOOKING_DETAIL_SELECT)
        .eq('checkout_idempotency_key', checkoutId)
        .maybeSingle(),
      supabase.from('bikini_mix_event').select('event_name, event_date, venue').eq('id', 'default').maybeSingle()
    ])

    if (error) {
      console.error('[bikini-mix confirmation] lookup failed:', error.message)
      setResponseStatus(event, 500)
      return { found: false }
    }
    if (!row || !row.paid_at) {
      return { found: false }
    }

    const booking = mapBookingDetail(row)
    return {
      found: true,
      booking: {
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        fullName: booking.fullName,
        package: booking.package,
        retailPriceXcdCents: booking.retailPriceXcdCents,
        chargedUsdCents: booking.chargedUsdCents,
        topSize: booking.topSize,
        leftFabricName: booking.leftFabricName,
        rightFabricName: booking.rightFabricName,
        bottomStyle: booking.bottomStyle,
        bottomCoverage: booking.bottomCoverage,
        bottomSize: booking.bottomSize,
        bottomFabricName: booking.bottomFabricName,
        personalizationName: booking.personalizationName,
        paidAt: booking.paidAt
      },
      event: {
        eventName: eventRow?.event_name || 'The Bikini Mixer',
        eventDate: eventRow?.event_date || null,
        venue: eventRow?.venue || null
      }
    }
  } catch (err) {
    console.error('[bikini-mix confirmation] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { found: false }
  }
})

function norm(v) {
  return typeof v === 'string' ? v.trim() : ''
}
