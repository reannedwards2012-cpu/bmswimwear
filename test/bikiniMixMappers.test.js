import { describe, it, expect } from 'vitest'
import { mapEvent, mapPublicEvent, mapBookingListItem, mapBookingDetail, formatBookingNumber } from '../server/utils/bikiniMixMappers.js'

function eventRow(overrides = {}) {
  return {
    id: 'default',
    event_name: 'The Bikini Mix by Bahama Mama',
    event_date: '2026-12-12',
    event_date_is_tentative: true,
    venue: 'The Closet, Grenada',
    venue_is_confirmed: true,
    booking_deadline: '2026-11-20',
    cancellation_deadline: '2026-11-20',
    capacity: 12,
    is_bookings_open: false,
    promo_video_url: null,
    classic_mix_price_xcd_cents: 16000,
    classic_mix_inclusions: ['1 triangle bikini top'],
    the_works_price_xcd_cents: 20000,
    the_works_inclusions: ['1 triangle bikini top'],
    hold_minutes: 15,
    top_size_guide: [
      { size: 'XS', bust: '', underbust: '' },
      { size: 'S', bust: '', underbust: '' },
      { size: 'M', bust: '', underbust: '' },
      { size: 'L', bust: '', underbust: '' },
      { size: 'XL', bust: '', underbust: '' }
    ],
    bottom_size_guide: [
      { size: 'XS', waist: '', hip: '' },
      { size: 'S', waist: '', hip: '' },
      { size: 'M', waist: '', hip: '' },
      { size: 'L', waist: '', hip: '' },
      { size: 'XL', waist: '', hip: '' }
    ],
    updated_at: '2026-10-19T00:00:00Z',
    ...overrides
  }
}

describe('formatBookingNumber', () => {
  it('pads to 6 digits with a BKM- prefix', () => {
    expect(formatBookingNumber(7)).toBe('BKM-000007')
    expect(formatBookingNumber(123456)).toBe('BKM-123456')
  })
})

describe('mapPublicEvent', () => {
  it('carries the size guides through to the customer-facing shape', () => {
    const row = eventRow({
      bottom_size_guide: [
        { size: 'XS', waist: '24–26', hip: '34–36' },
        { size: 'S', waist: '26–28', hip: '36–38' },
        { size: 'M', waist: '28–30', hip: '38–40' },
        { size: 'L', waist: '30–32', hip: '40–42' },
        { size: 'XL', waist: '32–34', hip: '42–44' }
      ]
    })
    const mapped = mapPublicEvent(row)
    expect(mapped.bottomSizeGuide).toEqual([
      { size: 'XS', waist: '24–26', hip: '34–36' },
      { size: 'S', waist: '26–28', hip: '36–38' },
      { size: 'M', waist: '28–30', hip: '38–40' },
      { size: 'L', waist: '30–32', hip: '40–42' },
      { size: 'XL', waist: '32–34', hip: '42–44' }
    ])
    expect(mapped.topSizeGuide).toEqual(row.top_size_guide)
  })

  it('never includes capacity or hold_minutes', () => {
    const mapped = mapPublicEvent(eventRow())
    expect(mapped.capacity).toBeUndefined()
    expect(mapped.holdMinutes).toBeUndefined()
  })
})

describe('mapEvent — sizeGuideComplete (the launch gate)', () => {
  // Top sizing is the approved fixed cup-size approximation (XS=A..XL=DD),
  // hardcoded customer-facing copy, NOT this admin bust/underbust table —
  // so a blank top_size_guide must never block launch. Only the finalized
  // bottom (waist/hip) guide gates it.
  it('blank (freshly-seeded) size guide -> not complete', () => {
    const mapped = mapEvent(eventRow())
    expect(mapped.sizeGuideComplete).toBe(false)
  })

  it('bottom guide filled in, top guide left blank -> complete', () => {
    const row = eventRow({
      bottom_size_guide: [
        { size: 'XS', waist: '24"', hip: '34"' },
        { size: 'S', waist: '26"', hip: '36"' },
        { size: 'M', waist: '28"', hip: '38"' },
        { size: 'L', waist: '30"', hip: '40"' },
        { size: 'XL', waist: '32"', hip: '42"' }
      ]
    })
    expect(mapEvent(row).sizeGuideComplete).toBe(true)
  })

  it('top guide filled in, bottom guide left blank -> still not complete', () => {
    const row = eventRow({
      top_size_guide: [
        { size: 'XS', bust: '32"', underbust: '28"' },
        { size: 'S', bust: '33"', underbust: '29"' },
        { size: 'M', bust: '34"', underbust: '30"' },
        { size: 'L', bust: '36"', underbust: '32"' },
        { size: 'XL', bust: '38"', underbust: '34"' }
      ]
    })
    expect(mapEvent(row).sizeGuideComplete).toBe(false)
  })

  it('both guides fully filled in -> complete', () => {
    const row = eventRow({
      top_size_guide: [
        { size: 'XS', bust: '32"', underbust: '28"' },
        { size: 'S', bust: '33"', underbust: '29"' },
        { size: 'M', bust: '34"', underbust: '30"' },
        { size: 'L', bust: '36"', underbust: '32"' },
        { size: 'XL', bust: '38"', underbust: '34"' }
      ],
      bottom_size_guide: [
        { size: 'XS', waist: '24"', hip: '34"' },
        { size: 'S', waist: '26"', hip: '36"' },
        { size: 'M', waist: '28"', hip: '38"' },
        { size: 'L', waist: '30"', hip: '40"' },
        { size: 'XL', waist: '32"', hip: '42"' }
      ]
    })
    expect(mapEvent(row).sizeGuideComplete).toBe(true)
  })

  it('one blank cell among otherwise-filled bottom rows -> not complete', () => {
    const row = eventRow({
      bottom_size_guide: [
        { size: 'XS', waist: '24"', hip: '34"' },
        { size: 'S', waist: '', hip: '36"' }, // one blank cell
        { size: 'M', waist: '28"', hip: '38"' },
        { size: 'L', waist: '30"', hip: '40"' },
        { size: 'XL', waist: '32"', hip: '42"' }
      ]
    })
    expect(mapEvent(row).sizeGuideComplete).toBe(false)
  })

  it('maps camelCase fields and preserves package pricing/inclusions', () => {
    const mapped = mapEvent(eventRow())
    expect(mapped.classicMixPriceXcdCents).toBe(16000)
    expect(mapped.theWorksPriceXcdCents).toBe(20000)
    expect(mapped.classicMixInclusions).toEqual(['1 triangle bikini top'])
    expect(mapped.capacity).toBe(12)
    expect(mapped.isBookingsOpen).toBe(false)
  })
})

function bookingRow(overrides = {}) {
  return {
    id: 'bk-1',
    booking_number: 7,
    status: 'pending_payment',
    hold_expires_at: null,
    package: 'classic_mix',
    retail_price_xcd_cents: 16000,
    charged_usd_cents: null,
    top_size: 'M',
    left_fabric_id: 'f-1',
    left_fabric_name_snapshot: 'Baby Blue',
    left_fabric_hex_snapshot: '#aac8e8',
    right_fabric_id: 'f-2',
    right_fabric_name_snapshot: 'Red',
    right_fabric_hex_snapshot: '#c0392b',
    bottom_style: 'tie-side',
    bottom_coverage: 'bikini',
    bottom_size: 'M',
    bottom_fabric_id: 'f-3',
    bottom_fabric_name_snapshot: 'Yellow',
    bottom_fabric_hex_snapshot: '#f1c40f',
    full_name: 'Jane Doe',
    email: 'jane@example.com',
    whatsapp: '+14735551234',
    personalization_name: null,
    marketing_opt_in: false,
    terms_accepted_at: '2026-10-19T00:00:00Z',
    payment_provider: 'go2pay',
    go2pay_order_id: null,
    payment_id: null,
    paid_at: null,
    admin_notes: null,
    created_at: '2026-10-19T00:00:00Z',
    updated_at: '2026-10-19T00:00:00Z',
    ...overrides
  }
}

describe('displayStatus (expired is computed, never stored)', () => {
  it('a live hold stays "pending_payment"', () => {
    const future = new Date(Date.now() + 10 * 60_000).toISOString()
    const mapped = mapBookingListItem(bookingRow({ status: 'pending_payment', hold_expires_at: future }))
    expect(mapped.displayStatus).toBe('pending_payment')
    expect(mapped.status).toBe('pending_payment') // the real DB status is untouched
  })

  it('a lapsed hold displays as "expired" without the underlying status changing', () => {
    const past = new Date(Date.now() - 10 * 60_000).toISOString()
    const mapped = mapBookingListItem(bookingRow({ status: 'pending_payment', hold_expires_at: past }))
    expect(mapped.displayStatus).toBe('expired')
    expect(mapped.status).toBe('pending_payment')
  })

  it('confirmed/paid_needs_review/cancelled pass through unchanged regardless of hold_expires_at', () => {
    const past = new Date(Date.now() - 10 * 60_000).toISOString()
    expect(mapBookingListItem(bookingRow({ status: 'confirmed', hold_expires_at: past })).displayStatus).toBe('confirmed')
    expect(mapBookingListItem(bookingRow({ status: 'paid_needs_review', hold_expires_at: past })).displayStatus).toBe(
      'paid_needs_review'
    )
    expect(mapBookingListItem(bookingRow({ status: 'cancelled', hold_expires_at: past })).displayStatus).toBe('cancelled')
  })

  it('mapBookingDetail reports the same displayStatus logic as the list mapper', () => {
    const past = new Date(Date.now() - 10 * 60_000).toISOString()
    const detail = mapBookingDetail(bookingRow({ status: 'pending_payment', hold_expires_at: past }))
    expect(detail.displayStatus).toBe('expired')
    expect(detail.bookingNumber).toBe('BKM-000007')
  })
})

describe('mapBookingDetail — variant distinctness survives mapping', () => {
  it('left/right triangle and bottom keep independent fabric snapshots', () => {
    const detail = mapBookingDetail(bookingRow())
    expect(detail.leftFabricName).toBe('Baby Blue')
    expect(detail.rightFabricName).toBe('Red')
    expect(detail.bottomFabricName).toBe('Yellow')
    expect(detail.leftFabricName).not.toBe(detail.rightFabricName)
  })
})
