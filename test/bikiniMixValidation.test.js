import { describe, it, expect } from 'vitest'
import { validateEventFields, validateBookingResolution, validateBookingCheckout } from '../server/utils/bikiniMixValidation.js'

describe('validateEventFields', () => {
  it('valid partial update', () => {
    const { issues, fields } = validateEventFields({ eventName: 'The Bikini Mix', capacity: 12 }, { partial: true })
    expect(issues).toEqual([])
    expect(fields).toEqual({ eventName: 'The Bikini Mix', capacity: 12 })
  })

  it('rejects an empty event name when provided', () => {
    const { issues } = validateEventFields({ eventName: '' }, { partial: true })
    expect(issues.some((m) => /name/i.test(m))).toBe(true)
  })

  it('rejects an invalid date', () => {
    const { issues } = validateEventFields({ eventDate: 'not-a-date' }, { partial: true })
    expect(issues.some((m) => /date/i.test(m))).toBe(true)
  })

  it('capacity must be a positive integer', () => {
    expect(validateEventFields({ capacity: 0 }, { partial: true }).issues.length).toBeGreaterThan(0)
    expect(validateEventFields({ capacity: -5 }, { partial: true }).issues.length).toBeGreaterThan(0)
    expect(validateEventFields({ capacity: 1.5 }, { partial: true }).issues.length).toBeGreaterThan(0)
  })

  it('hold minutes must be a positive integer', () => {
    expect(validateEventFields({ holdMinutes: 0 }, { partial: true }).issues.length).toBeGreaterThan(0)
  })

  it('prices must be non-negative integer cents', () => {
    expect(validateEventFields({ classicMixPriceXcdCents: -1 }, { partial: true }).issues.length).toBeGreaterThan(0)
    expect(validateEventFields({ theWorksPriceXcdCents: 1.5 }, { partial: true }).issues.length).toBeGreaterThan(0)
    const ok = validateEventFields({ classicMixPriceXcdCents: 16000 }, { partial: true })
    expect(ok.issues).toEqual([])
    expect(ok.fields.classicMixPriceXcdCents).toBe(16000)
  })

  it('inclusions must be a list of reasonable strings', () => {
    const { issues, fields } = validateEventFields({ classicMixInclusions: ['6 beads', '1 charm'] }, { partial: true })
    expect(issues).toEqual([])
    expect(fields.classicMixInclusions).toEqual(['6 beads', '1 charm'])
  })
  it('rejects a non-array inclusions value', () => {
    const { issues } = validateEventFields({ theWorksInclusions: 'not an array' }, { partial: true })
    expect(issues.length).toBeGreaterThan(0)
  })

  it('boolean toggles must actually be booleans', () => {
    expect(validateEventFields({ isBookingsOpen: 'yes' }, { partial: true }).issues.length).toBeGreaterThan(0)
    const ok = validateEventFields({ isBookingsOpen: true }, { partial: true })
    expect(ok.issues).toEqual([])
  })

  describe('size guide — never invents values, just validates structure', () => {
    const blankTop = [
      { size: 'XS', bust: '', underbust: '' },
      { size: 'S', bust: '', underbust: '' },
      { size: 'M', bust: '', underbust: '' },
      { size: 'L', bust: '', underbust: '' },
      { size: 'XL', bust: '', underbust: '' }
    ]

    it('accepts a blank (not-yet-filled-in) top size guide unchanged', () => {
      const { issues, fields } = validateEventFields({ topSizeGuide: blankTop }, { partial: true })
      expect(issues).toEqual([])
      expect(fields.topSizeGuide).toEqual(blankTop)
    })

    it('accepts a filled-in row and preserves the real measurement text verbatim', () => {
      const filled = [{ ...blankTop[0], bust: '32"', underbust: '28"' }, ...blankTop.slice(1)]
      const { issues, fields } = validateEventFields({ topSizeGuide: filled }, { partial: true })
      expect(issues).toEqual([])
      expect(fields.topSizeGuide[0]).toEqual({ size: 'XS', bust: '32"', underbust: '28"' })
    })

    it('rejects a wrong number of rows', () => {
      const { issues } = validateEventFields({ topSizeGuide: blankTop.slice(0, 3) }, { partial: true })
      expect(issues.length).toBeGreaterThan(0)
    })

    it('rejects rows out of XS..XL order', () => {
      const reordered = [blankTop[1], blankTop[0], ...blankTop.slice(2)]
      const { issues } = validateEventFields({ topSizeGuide: reordered }, { partial: true })
      expect(issues.length).toBeGreaterThan(0)
    })

    it('bottom size guide uses waist/hip fields', () => {
      const blankBottom = [
        { size: 'XS', waist: '', hip: '' },
        { size: 'S', waist: '', hip: '' },
        { size: 'M', waist: '', hip: '' },
        { size: 'L', waist: '', hip: '' },
        { size: 'XL', waist: '', hip: '' }
      ]
      const { issues, fields } = validateEventFields({ bottomSizeGuide: blankBottom }, { partial: true })
      expect(issues).toEqual([])
      expect(fields.bottomSizeGuide).toEqual(blankBottom)
    })
  })
})

describe('validateBookingResolution', () => {
  it('accepts "confirm"', () => {
    const { issues, fields } = validateBookingResolution({ resolution: 'confirm' })
    expect(issues).toEqual([])
    expect(fields.resolution).toBe('confirm')
  })
  it('accepts "cancel" with notes', () => {
    const { issues, fields } = validateBookingResolution({ resolution: 'cancel', adminNotes: 'Refunded per policy' })
    expect(issues).toEqual([])
    expect(fields.adminNotes).toBe('Refunded per policy')
  })
  it('rejects an unknown resolution', () => {
    const { issues } = validateBookingResolution({ resolution: 'approve' })
    expect(issues.length).toBeGreaterThan(0)
  })
  it('rejects a missing resolution', () => {
    const { issues } = validateBookingResolution({})
    expect(issues.length).toBeGreaterThan(0)
  })
})

function checkoutPayload(overrides = {}) {
  return {
    checkoutIdempotencyKey: '11111111-1111-1111-1111-111111111111',
    package: 'classic_mix',
    topSize: 'M',
    bottomSize: 'M',
    bottomStyle: 'tie-side',
    bottomCoverage: 'bikini',
    leftFabricId: '22222222-2222-2222-2222-222222222222',
    rightFabricId: '22222222-2222-2222-2222-222222222222',
    bottomFabricId: '22222222-2222-2222-2222-222222222222',
    fullName: 'Jane Guest',
    email: 'jane@example.com',
    whatsapp: '+1 473 555 1234',
    personalizationName: null,
    marketingOptIn: false,
    termsAccepted: true,
    ...overrides
  }
}

describe('validateBookingCheckout', () => {
  it('accepts a fully valid Classic Mix payload', () => {
    const { issues, fields } = validateBookingCheckout(checkoutPayload())
    expect(issues).toEqual([])
    expect(fields.package).toBe('classic_mix')
    expect(fields.personalizationName).toBeNull()
  })

  it('requires personalizationName for The Works', () => {
    const { issues } = validateBookingCheckout(checkoutPayload({ package: 'the_works', personalizationName: null }))
    expect(issues.some((i) => /personalization/i.test(i))).toBe(true)
  })

  it('accepts The Works with a personalization name', () => {
    const { issues } = validateBookingCheckout(checkoutPayload({ package: 'the_works', personalizationName: 'Jane' }))
    expect(issues).toEqual([])
  })

  it('rejects an invalid package', () => {
    const { issues } = validateBookingCheckout(checkoutPayload({ package: 'deluxe_mix' }))
    expect(issues.some((i) => /package/i.test(i))).toBe(true)
  })

  it('rejects invalid sizes, style and coverage', () => {
    const { issues } = validateBookingCheckout(checkoutPayload({ topSize: 'XXL', bottomStyle: 'thong', bottomCoverage: 'full' }))
    expect(issues.some((i) => /topSize/.test(i))).toBe(true)
    expect(issues.some((i) => /bottomStyle/.test(i))).toBe(true)
    expect(issues.some((i) => /bottomCoverage/.test(i))).toBe(true)
  })

  it('rejects non-UUID fabric ids', () => {
    const { issues } = validateBookingCheckout(checkoutPayload({ leftFabricId: 'not-a-uuid' }))
    expect(issues.some((i) => /leftFabricId/.test(i))).toBe(true)
  })

  it('rejects an invalid email', () => {
    const { issues } = validateBookingCheckout(checkoutPayload({ email: 'not-an-email' }))
    expect(issues.some((i) => /email/i.test(i))).toBe(true)
  })

  it('rejects a too-short phone number', () => {
    const { issues } = validateBookingCheckout(checkoutPayload({ whatsapp: '123' }))
    expect(issues.some((i) => /phone/i.test(i))).toBe(true)
  })

  it('rejects a missing full name', () => {
    const { issues } = validateBookingCheckout(checkoutPayload({ fullName: '  ' }))
    expect(issues.some((i) => /name/i.test(i))).toBe(true)
  })

  it('rejects when terms are not accepted', () => {
    const { issues } = validateBookingCheckout(checkoutPayload({ termsAccepted: false }))
    expect(issues.some((i) => /agree/i.test(i))).toBe(true)
  })

  it('rejects a missing checkoutIdempotencyKey', () => {
    const { issues } = validateBookingCheckout(checkoutPayload({ checkoutIdempotencyKey: null }))
    expect(issues.some((i) => /checkoutIdempotencyKey/.test(i))).toBe(true)
  })
})
