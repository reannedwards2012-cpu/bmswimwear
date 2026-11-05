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
    expect(validateEventFields({ regularPriceXcdCents: -1 }, { partial: true }).issues.length).toBeGreaterThan(0)
    expect(validateEventFields({ earlyBirdPriceXcdCents: 1.5 }, { partial: true }).issues.length).toBeGreaterThan(0)
    const ok = validateEventFields({ regularPriceXcdCents: 25000 }, { partial: true })
    expect(ok.issues).toEqual([])
    expect(ok.fields.regularPriceXcdCents).toBe(25000)
  })

  it('early bird slot count must be a positive integer', () => {
    expect(validateEventFields({ earlyBirdSlots: 0 }, { partial: true }).issues.length).toBeGreaterThan(0)
    expect(validateEventFields({ earlyBirdSlots: 1.5 }, { partial: true }).issues.length).toBeGreaterThan(0)
    const ok = validateEventFields({ earlyBirdSlots: 3 }, { partial: true })
    expect(ok.issues).toEqual([])
    expect(ok.fields.earlyBirdSlots).toBe(3)
  })

  it('ticket inclusions must be a list of reasonable strings', () => {
    const { issues, fields } = validateEventFields({ ticketInclusions: ['The swimsuit', 'Event access'] }, { partial: true })
    expect(issues).toEqual([])
    expect(fields.ticketInclusions).toEqual(['The swimsuit', 'Event access'])
  })
  it('rejects a non-array inclusions value', () => {
    const { issues } = validateEventFields({ ticketInclusions: 'not an array' }, { partial: true })
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

function bikiniPayload(overrides = {}) {
  return {
    checkoutIdempotencyKey: '11111111-1111-1111-1111-111111111111',
    garmentType: 'bikini',
    topSize: 'M',
    bottomSize: 'M',
    bottomStyle: 'tie-side',
    bottomCoverage: 'bikini',
    bottomScrunch: false,
    leftFabricId: '22222222-2222-2222-2222-222222222222',
    rightFabricId: '22222222-2222-2222-2222-222222222222',
    bottomFabricId: '22222222-2222-2222-2222-222222222222',
    fullName: 'Jane Guest',
    email: 'jane@example.com',
    whatsapp: '+1 473 555 1234',
    marketingOptIn: false,
    termsAccepted: true,
    ...overrides
  }
}

function onepiecePayload(overrides = {}) {
  return {
    checkoutIdempotencyKey: '11111111-1111-1111-1111-111111111111',
    garmentType: 'onepiece',
    onepieceSize: 'M',
    onepieceCoverage: 'cheeky',
    onepieceFabricId: '22222222-2222-2222-2222-222222222222',
    fullName: 'Jane Guest',
    email: 'jane@example.com',
    whatsapp: '+1 473 555 1234',
    marketingOptIn: false,
    termsAccepted: true,
    ...overrides
  }
}

// kept as the legacy alias name used by older tests in this file
const checkoutPayload = bikiniPayload

describe('validateBookingCheckout', () => {
  it('accepts a fully valid bikini payload', () => {
    const { issues, fields } = validateBookingCheckout(bikiniPayload())
    expect(issues).toEqual([])
    expect(fields.garmentType).toBe('bikini')
    expect(fields.onepieceFabricId).toBeNull()
  })

  it('accepts a fully valid one-piece payload, with bikini-only fields nulled out', () => {
    const { issues, fields } = validateBookingCheckout(onepiecePayload())
    expect(issues).toEqual([])
    expect(fields.garmentType).toBe('onepiece')
    expect(fields.onepieceSize).toBe('M')
    expect(fields.onepieceCoverage).toBe('cheeky')
    expect(fields.onepieceFabricId).toBe('22222222-2222-2222-2222-222222222222')
    expect(fields.topSize).toBeNull()
    expect(fields.bottomStyle).toBeNull()
    expect(fields.leftFabricId).toBeNull()
  })

  it('rejects a missing/invalid garmentType', () => {
    const { issues } = validateBookingCheckout(bikiniPayload({ garmentType: 'tankini' }))
    expect(issues.some((i) => /garmentType/.test(i))).toBe(true)
  })

  it('a one-piece payload never requires bottomStyle/bottomCoverage/scrunch', () => {
    const { issues } = validateBookingCheckout(onepiecePayload())
    expect(issues.some((i) => /bottomStyle|bottomCoverage/.test(i))).toBe(false)
  })

  it('rejects an incomplete one-piece payload (missing fabric)', () => {
    const { issues } = validateBookingCheckout(onepiecePayload({ onepieceFabricId: null }))
    expect(issues.some((i) => /onepieceFabricId/.test(i))).toBe(true)
  })

  it('bottomScrunch defaults to false and accepts true', () => {
    expect(validateBookingCheckout(bikiniPayload()).fields.bottomScrunch).toBe(false)
    expect(validateBookingCheckout(bikiniPayload({ bottomScrunch: true })).fields.bottomScrunch).toBe(true)
  })

  it('rejects invalid sizes, style and coverage', () => {
    const { issues } = validateBookingCheckout(bikiniPayload({ topSize: 'XXL', bottomStyle: 'thong', bottomCoverage: 'full' }))
    expect(issues.some((i) => /topSize/.test(i))).toBe(true)
    expect(issues.some((i) => /bottomStyle/.test(i))).toBe(true)
    expect(issues.some((i) => /bottomCoverage/.test(i))).toBe(true)
  })

  it('rejects non-UUID fabric ids', () => {
    const { issues } = validateBookingCheckout(bikiniPayload({ leftFabricId: 'not-a-uuid' }))
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

  it('measurements are entirely optional — a payload with none provided is still valid', () => {
    const { issues, fields } = validateBookingCheckout(bikiniPayload())
    expect(issues).toEqual([])
    expect(fields.bustInches).toBeNull()
    expect(fields.underbustInches).toBeNull()
    expect(fields.waistInches).toBeNull()
    expect(fields.hipsInches).toBeNull()
  })

  it('accepts a full set of valid decimal measurements', () => {
    const { issues, fields } = validateBookingCheckout(
      bikiniPayload({ bustInches: 36.5, underbustInches: 30, waistInches: 28.5, hipsInches: 39 })
    )
    expect(issues).toEqual([])
    expect(fields.bustInches).toBe(36.5)
    expect(fields.underbustInches).toBe(30)
    expect(fields.waistInches).toBe(28.5)
    expect(fields.hipsInches).toBe(39)
  })

  it('accepts a partial set of measurements, leaving the rest null', () => {
    const { issues, fields } = validateBookingCheckout(bikiniPayload({ waistInches: 27 }))
    expect(issues).toEqual([])
    expect(fields.waistInches).toBe(27)
    expect(fields.bustInches).toBeNull()
    expect(fields.underbustInches).toBeNull()
    expect(fields.hipsInches).toBeNull()
  })

  it('rejects a non-numeric, zero, negative, or unrealistic measurement', () => {
    expect(validateBookingCheckout(bikiniPayload({ bustInches: 'abc' })).issues.some((i) => /Bust/.test(i))).toBe(true)
    expect(validateBookingCheckout(bikiniPayload({ waistInches: 0 })).issues.some((i) => /Waist/.test(i))).toBe(true)
    expect(validateBookingCheckout(bikiniPayload({ hipsInches: -5 })).issues.some((i) => /Hips/.test(i))).toBe(true)
    expect(validateBookingCheckout(bikiniPayload({ underbustInches: 999 })).issues.some((i) => /Underbust/.test(i))).toBe(true)
  })

  it('rounds a measurement to one decimal place', () => {
    const { fields } = validateBookingCheckout(bikiniPayload({ bustInches: 36.456 }))
    expect(fields.bustInches).toBe(36.5)
  })
})
