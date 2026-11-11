/**
 * PATCH /api/admin/bikini-mix/event
 *
 * Admin-only. Partial update of the single event config row — dates, venue,
 * capacity, open/closed, package pricing/inclusions, hold duration, size
 * guide. The row itself ('default') is never created/deleted here.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { validateEventFields } from '../../../utils/bikiniMixValidation.js'
import { EVENT_SELECT, mapEvent } from '../../../utils/bikiniMixMappers.js'
import { isMigrationNotAppliedError } from '../../../utils/bikiniMixMigrationGuard.js'

const COLUMN_BY_FIELD = {
  eventName: 'event_name',
  eventDate: 'event_date',
  eventDateIsTentative: 'event_date_is_tentative',
  venue: 'venue',
  venueIsConfirmed: 'venue_is_confirmed',
  bookingDeadline: 'booking_deadline',
  cancellationDeadline: 'cancellation_deadline',
  capacity: 'capacity',
  isBookingsOpen: 'is_bookings_open',
  promoVideoUrl: 'promo_video_url',
  promoVideoThumbnailUrl: 'promo_video_thumbnail_url',
  regularPriceXcdCents: 'regular_price_xcd_cents',
  earlyBirdPriceXcdCents: 'early_bird_price_xcd_cents',
  earlyBirdSlots: 'early_bird_slots',
  ticketInclusions: 'ticket_inclusions',
  compEventAssistantSlots: 'comp_event_assistant_slots',
  compGiveawaySlots: 'comp_giveaway_slots',
  compOtherSlots: 'comp_other_slots',
  holdMinutes: 'hold_minutes',
  topSizeGuide: 'top_size_guide',
  bottomSizeGuide: 'bottom_size_guide'
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const { issues, fields } = validateEventFields(body, { partial: true })
  if (issues.length) {
    setResponseStatus(event, 400)
    return { error: 'Invalid event details.', issues }
  }

  const patch = { updated_at: new Date().toISOString() }
  for (const [key, column] of Object.entries(COLUMN_BY_FIELD)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) patch[column] = fields[key]
  }
  if (Object.keys(patch).length === 1) {
    setResponseStatus(event, 400)
    return { error: 'No changes were provided.' }
  }

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('bikini_mix_event')
      .update(patch)
      .eq('id', 'default')
      .select(EVENT_SELECT)
      .maybeSingle()

    if (error) {
      if (isMigrationNotAppliedError(error)) {
        setResponseStatus(event, 503)
        return { configured: false, error: 'Swimsuit Mixer migration not applied yet — changes cannot be saved.' }
      }
      console.error('[admin/bikini-mix/event] update failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update event settings.' }
    }
    if (!data) {
      setResponseStatus(event, 404)
      return { error: 'Event configuration not found.' }
    }

    return { event: mapEvent(data) }
  } catch (err) {
    console.error('[admin/bikini-mix/event] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update event settings.' }
  }
})
