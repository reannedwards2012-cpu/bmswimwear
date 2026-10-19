/**
 * The Bikini Mix event config for the customer-facing pages.
 *
 * Always tries the REAL endpoint first (server/api/bikini-mix/event.get.js,
 * which reads the live bikini_mix_event row — the same row the admin
 * Settings page edits). Falls back to DEV-ONLY mock data — clearly flagged
 * via `isMock` — only when that fails, which today it always will, since
 * the migration creating bikini_mix_event has not been applied yet. Once
 * it is, this composable needs no changes: the real fetch will simply
 * start succeeding.
 *
 * Nothing here is a permanent hardcoded substitute for the admin settings —
 * `MOCK_EVENT` exists only to make these screens reviewable right now, and
 * every value in it matches what's already been approved for the real
 * event (section 1 of the approved brief), not invented content.
 */
const MOCK_EVENT = {
  eventName: 'The Bikini Mixer by Bahama Mama',
  eventDate: '2026-12-12',
  eventDateIsTentative: true,
  venue: 'The Closet, Grenada',
  venueIsConfirmed: true,
  bookingDeadline: '2026-11-20',
  cancellationDeadline: '2026-11-20',
  isBookingsOpen: true,
  promoVideoUrl: null,
  classicMixPriceXcdCents: 16000,
  classicMixInclusions: [
    '1 triangle bikini top',
    '1 bikini bottom',
    'Up to 4 straps',
    '1 standard charm',
    '6 beads',
    '1 iron-on transfer',
    'Access to The Bikini Mix experience'
  ],
  theWorksPriceXcdCents: 20000,
  theWorksInclusions: [
    '1 triangle bikini top',
    '1 bikini bottom',
    'Up to 4 straps',
    '2 standard charms',
    '1 premium charm',
    '12 beads',
    '3 iron-on transfers',
    'Up to 50 rhinestones',
    'Personalized packaging (name on bag and personalized trinket)',
    'Access to The Bikini Mix experience'
  ],
  // Top guide stays blank — real bust/underbust numbers haven't been taken
  // from the patterns yet (same "never invent measurements" rule as the
  // admin Settings page). Bottom guide mirrors the real approved waist/hip
  // measurements already seeded in the migration's bottom_size_guide default.
  topSizeGuide: [
    { size: 'XS', bust: '', underbust: '' },
    { size: 'S', bust: '', underbust: '' },
    { size: 'M', bust: '', underbust: '' },
    { size: 'L', bust: '', underbust: '' },
    { size: 'XL', bust: '', underbust: '' }
  ],
  bottomSizeGuide: [
    { size: 'XS', waist: '24–26', hip: '34–36' },
    { size: 'S', waist: '26–28', hip: '36–38' },
    { size: 'M', waist: '28–30', hip: '38–40' },
    { size: 'L', waist: '30–32', hip: '40–42' },
    { size: 'XL', waist: '32–34', hip: '42–44' }
  ]
}

export async function useBikiniMixEvent() {
  // The endpoint responds 503 while bikini_mix_event doesn't exist yet,
  // which $fetch throws on — caught here (not left as an error state) since
  // "use the mock" is the expected, handled outcome today, not a failure.
  const { data, pending, error } = await useLazyAsyncData(
    'bikini-mix-public-event',
    () => $fetch('/api/bikini-mix/event').catch(() => ({ configured: false })),
    { server: false }
  )

  const event = computed(() => {
    if (data.value?.configured) return data.value.event
    return MOCK_EVENT
  })
  const isMock = computed(() => !data.value?.configured)

  return { event, isMock, pending, error }
}
