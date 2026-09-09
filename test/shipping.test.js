import { describe, it, expect } from 'vitest'
import {
  billableWeightLb,
  roundBillableLb,
  UnknownCategoryError,
  zoneForCountry,
  internationalShippingUsdCents,
  xcdCentsToUsdCents,
  resolveDelivery,
  isStGeorge,
  deliveryLabel,
  zoneLabel,
  ZONE_RATES,
  HANDLING_XCD_CENTS,
  UNSUPPORTED_DESTINATION_MESSAGE
} from '../server/utils/shipping.js'

// ── weight ───────────────────────────────────────────────────────────────
describe('roundBillableLb — Grenada Post whole-pound rounding, 1 lb minimum', () => {
  it.each([
    [0.25, 1],
    [1.0, 1],
    [1.4, 1],
    [1.5, 2],
    [2.4, 2],
    [2.5, 3],
    [0, 1]
  ])('%d lb → %d billable lb', (input, expected) => {
    expect(roundBillableLb(input)).toBe(expected)
  })
})

describe('billableWeightLb — category weights × quantity', () => {
  it('one Top (0.25 lb) → 1 billable lb (minimum)', () => {
    expect(billableWeightLb([{ category: 'Tops', quantity: 1 }])).toBe(1)
  })
  it('four Tops (1.00 lb) → 1 billable lb', () => {
    expect(billableWeightLb([{ category: 'Tops', quantity: 4 }])).toBe(1)
  })
  it('two One Pieces (1.00 lb) → 1 billable lb', () => {
    expect(billableWeightLb([{ category: 'One Pieces', quantity: 2 }])).toBe(1)
  })
  it('three One Pieces (1.50 lb) → 2 billable lb', () => {
    expect(billableWeightLb([{ category: 'One Pieces', quantity: 3 }])).toBe(2)
  })
  it('mixed cart, quantities add up: 2 One Pieces + 3 Bottoms = 1.75 lb → 2 billable lb', () => {
    expect(
      billableWeightLb([
        { category: 'One Pieces', quantity: 2 },
        { category: 'Bottoms', quantity: 3 }
      ])
    ).toBe(2)
  })
  it('5 One Pieces + 1 Cover Up = 3.0 lb → 3 billable lb', () => {
    expect(
      billableWeightLb([
        { category: 'One Pieces', quantity: 5 },
        { category: 'Cover Ups', quantity: 1 }
      ])
    ).toBe(3)
  })
  it('throws UnknownCategoryError for an unrecognised category (never guessed)', () => {
    expect(() => billableWeightLb([{ category: 'Accessories', quantity: 1 }])).toThrow(UnknownCategoryError)
  })
  it('throws for an invalid quantity', () => {
    expect(() => billableWeightLb([{ category: 'Tops', quantity: 0 }])).toThrow()
  })
})

// ── country → zone ───────────────────────────────────────────────────────
describe('zoneForCountry', () => {
  it.each([
    ['United States', 'usa'],
    ['Canada', 'canada'],
    ['United Kingdom', 'uk'],
    ['Jamaica', 'caribbean'],
    ['Barbados', 'caribbean'],
    ['Brazil', 'south_america'],
    ['Panama', 'central_america'],
    ['France', 'europe'],
    ['Nigeria', 'africa'],
    ['Japan', 'asia'],
    ['Israel', 'middle_east']
  ])('%s → %s', (country, zone) => {
    expect(zoneForCountry(country)).toBe(zone)
  })

  it('Grenada is NOT an international destination (excluded from Caribbean)', () => {
    expect(zoneForCountry('Grenada')).toBeNull()
  })

  it.each([
    'Australia',
    'New Zealand',
    'Mexico',
    'Bermuda',
    'Guyana',
    'Puerto Rico',
    'United States Virgin Islands'
  ])('%s is currently unmapped → null (safe unsupported handling)', (country) => {
    expect(zoneForCountry(country)).toBeNull()
  })

  it('"Other" and unknown strings → null', () => {
    expect(zoneForCountry('Other')).toBeNull()
    expect(zoneForCountry('Narnia')).toBeNull()
    expect(zoneForCountry('')).toBeNull()
  })
})

// ── money conversion ─────────────────────────────────────────────────────
describe('xcdCentsToUsdCents — US$1 = EC$2.70, integer cents', () => {
  it('EC$27.00 → US$10.00', () => {
    expect(xcdCentsToUsdCents(2700)).toBe(1000)
  })
  it('EC$40.00 → US$14.81 (rounded)', () => {
    expect(xcdCentsToUsdCents(4000)).toBe(1481)
  })
  it('always returns an integer number of cents', () => {
    for (const xcd of [3000, 3400, 4100, 10500, 12900, 15500, 999]) {
      const c = xcdCentsToUsdCents(xcd)
      expect(Number.isInteger(c)).toBe(true)
    }
  })
})

// ── zone rates ───────────────────────────────────────────────────────────
describe('internationalShippingUsdCents — first lb + additional lb + EC$10 handling', () => {
  // expected = round((firstLb + (lb-1)*addlLb + 1000) * 10 / 27)
  const expected = (zone, lb) => {
    const r = ZONE_RATES[zone]
    return Math.round((r.firstLb + (lb - 1) * r.addlLb + HANDLING_XCD_CENTS) * 10 / 27)
  }

  it.each(Object.keys(ZONE_RATES))('%s: matches the formula at 1 lb and 3 lb', (zone) => {
    expect(internationalShippingUsdCents(zone, 1)).toBe(expected(zone, 1))
    expect(internationalShippingUsdCents(zone, 3)).toBe(expected(zone, 3))
  })

  it('spot values (Caribbean 1 lb, USA 2 lb, Europe 3 lb)', () => {
    expect(internationalShippingUsdCents('caribbean', 1)).toBe(1481) // EC$(30+10) → *10/27
    expect(internationalShippingUsdCents('usa', 2)).toBe(1889) // EC$(34+7+10) → *10/27
    expect(internationalShippingUsdCents('europe', 3)).toBe(5741) // EC$(105+20+20+10) → *10/27
  })

  it('handling (EC$10) is folded into the charge exactly once', () => {
    // Caribbean 1 lb = EC$30 postage + EC$10 handling = EC$40 → US$14.81
    expect(internationalShippingUsdCents('caribbean', 1)).toBe(
      xcdCentsToUsdCents(ZONE_RATES.caribbean.firstLb + HANDLING_XCD_CENTS)
    )
  })
})

// ── St. George recognition ───────────────────────────────────────────────
describe('isStGeorge', () => {
  it.each(['St. George', 'Saint George', 'St George', "St. George's", 'Saint George Parish', 'saint george'])(
    'accepts %s',
    (r) => expect(isStGeorge(r)).toBe(true)
  )
  it.each(['Saint Andrew', 'St. David', 'Carriacou & Petite Martinique', '', 'George'])(
    'rejects %s',
    (r) => expect(isStGeorge(r)).toBe(false)
  )
})

// ── resolveDelivery ──────────────────────────────────────────────────────
const ITEMS = [{ category: 'One Pieces', quantity: 1 }]

describe('resolveDelivery — Grenada local delivery', () => {
  it('Grenada + Saint George → local delivery, no charge, no billable weight', () => {
    const r = resolveDelivery({ country: 'Grenada', region: 'Saint George', items: ITEMS })
    expect(r).toEqual({
      ok: true,
      method: 'local_delivery',
      zone: 'local',
      billableWeightLb: null,
      shippingUsdCents: 0
    })
  })
  it('Grenada + "St. George" variant also resolves to local delivery', () => {
    expect(resolveDelivery({ country: 'Grenada', region: "St. George's", items: ITEMS }).ok).toBe(true)
  })
  it('Grenada + another parish → rejected (grenada_parish)', () => {
    const r = resolveDelivery({ country: 'Grenada', region: 'Saint Andrew', items: ITEMS })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('grenada_parish')
  })
  it('Grenada + no parish → rejected', () => {
    expect(resolveDelivery({ country: 'Grenada', region: '', items: ITEMS }).ok).toBe(false)
  })
  it('Grenada local delivery carries NO handling charge', () => {
    expect(resolveDelivery({ country: 'Grenada', region: 'Saint George', items: ITEMS }).shippingUsdCents).toBe(0)
  })
})

describe('resolveDelivery — international', () => {
  it('supported country → international shipping with a computed charge', () => {
    const r = resolveDelivery({ country: 'United States', region: 'FL', items: ITEMS })
    expect(r.ok).toBe(true)
    expect(r.method).toBe('international_shipping')
    expect(r.zone).toBe('usa')
    expect(r.billableWeightLb).toBe(1)
    expect(r.shippingUsdCents).toBe(internationalShippingUsdCents('usa', 1))
  })
  it('quantity changes the billable weight and therefore the charge', () => {
    const one = resolveDelivery({ country: 'United States', region: '', items: [{ category: 'One Pieces', quantity: 1 }] })
    const three = resolveDelivery({ country: 'United States', region: '', items: [{ category: 'One Pieces', quantity: 3 }] })
    expect(one.billableWeightLb).toBe(1)
    expect(three.billableWeightLb).toBe(2)
    expect(three.shippingUsdCents).toBeGreaterThan(one.shippingUsdCents)
  })
  it('unsupported / unmapped country → rejected with the contact-us message, no charge', () => {
    for (const country of ['Australia', 'Mexico', 'Other']) {
      const r = resolveDelivery({ country, region: '', items: ITEMS })
      expect(r.ok).toBe(false)
      expect(r.code).toBe('unsupported_destination')
      expect(r.error).toBe(UNSUPPORTED_DESTINATION_MESSAGE)
    }
  })
  it('unknown product category on an international order → weight_config (never guessed)', () => {
    const r = resolveDelivery({
      country: 'United States',
      region: '',
      items: [{ category: 'Mystery', quantity: 1 }]
    })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('weight_config')
  })
  it('handling appears once per order even with multiple line items', () => {
    const r = resolveDelivery({
      country: 'Jamaica',
      region: '',
      items: [
        { category: 'Tops', quantity: 1 },
        { category: 'Bottoms', quantity: 1 }
      ]
    })
    // 0.5 lb total → billable 1 lb → EC$30 + EC$10 handling = EC$40 → 1481
    expect(r.shippingUsdCents).toBe(1481)
  })
})

describe('resolveDelivery — guard rails', () => {
  it('no country → rejected', () => {
    expect(resolveDelivery({ country: '', region: '', items: ITEMS }).ok).toBe(false)
  })
  it('empty cart → rejected', () => {
    expect(resolveDelivery({ country: 'United States', region: '', items: [] }).ok).toBe(false)
  })
})

describe('display labels', () => {
  it('local zone → "Local Delivery" (never "Shipping"/"Pickup")', () => {
    expect(deliveryLabel('local', 'shipping')).toBe('Local Delivery')
  })
  it('international zone → "International Shipping"', () => {
    expect(deliveryLabel('usa', 'shipping')).toBe('International Shipping')
    expect(zoneLabel('usa')).toBe('USA')
  })
  it('historical/manual rows with no zone fall back to the legacy label', () => {
    expect(deliveryLabel(null, 'pickup')).toBe('Pickup')
    expect(deliveryLabel(null, 'shipping')).toBe('Shipping')
    expect(zoneLabel(null)).toBeNull()
  })
})
