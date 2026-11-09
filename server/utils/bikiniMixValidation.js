/**
 * Server-side validation for admin Bikini Mix writes. Mirrors the style of
 * server/utils/stockistValidation.js / fabricValidation.js.
 */
const SIZES = ['XS', 'S', 'M', 'L', 'XL']
const MAX = {
  eventName: 160,
  venue: 160,
  inclusion: 120,
  inclusionsList: 20,
  adminNotes: 4000,
  measurement: 40,
  name: 120,
  email: 200,
  phone: 40,
  caption: 200
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const GARMENT_TYPES = ['bikini', 'onepiece']
const BOTTOM_STYLES = ['tie-side', 'classic']
const BOTTOM_COVERAGES = ['bikini', 'cheeky']
const GALLERY_CATEGORIES = ['strap', 'bead', 'charm', 'rhinestone', 'iron_on', 'finished_swimsuit']

const str = (v) => (typeof v === 'string' ? v.trim() : '')
const isEmpty = (v) => v === null || v === undefined || v === ''
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v)

function intOrNull(v) {
  if (isEmpty(v)) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : NaN
}

function dateOrNull(v) {
  if (isEmpty(v)) return null
  const s = str(v)
  return Number.isNaN(Date.parse(s)) ? NaN : s
}

// Body measurements (Step 3 "Your Measurements") — optional, inches, one
// decimal place. The range is a broad sanity bound, not a tight clinical
// one: wide enough to never reject a real customer, tight enough to catch
// obvious mistakes (0, negative, or a stray extra digit).
const MEASUREMENT_MIN = 10
const MEASUREMENT_MAX = 120
function measurementOrNull(v) {
  if (isEmpty(v)) return null
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n <= 0) return NaN
  return Math.round(n * 10) / 10
}

function validateInclusions(raw, label) {
  if (!Array.isArray(raw)) return { issues: [`${label} must be a list.`], values: [] }
  const values = raw.map((v) => str(v)).filter(Boolean)
  const issues = []
  if (values.length > MAX.inclusionsList) issues.push(`${label} has too many lines.`)
  if (values.some((v) => v.length > MAX.inclusion)) issues.push(`A ${label.toLowerCase()} line is too long.`)
  return { issues, values }
}

/**
 * A size-guide row list: [{ size: 'XS'|'S'|'M'|'L'|'XL', ...measurementFields }].
 * `fields` names the expected measurement keys (e.g. ['bust','underbust']) —
 * values are free text (so "34\"", "34-36", "86cm" etc. are all fine) and
 * are never required to be non-empty here (blank = not filled in yet is a
 * valid, expected state — see bikiniMixMappers.js `sizeGuideComplete`).
 */
function validateSizeGuide(raw, label, fields) {
  if (!Array.isArray(raw)) return { issues: [`${label} must be a list.`], values: [] }
  if (raw.length !== SIZES.length) {
    return { issues: [`${label} must have exactly one row per size (${SIZES.join(', ')}).`], values: [] }
  }
  const issues = []
  const values = raw.map((row, i) => {
    const size = str(row?.size)
    if (size !== SIZES[i]) issues.push(`${label} row ${i + 1} must be size "${SIZES[i]}".`)
    const out = { size: SIZES[i] }
    for (const f of fields) {
      const v = isEmpty(row?.[f]) ? '' : str(row[f])
      if (v.length > MAX.measurement) issues.push(`${label}: "${f}" for ${SIZES[i]} is too long.`)
      out[f] = v
    }
    return out
  })
  return { issues, values }
}

/**
 * @param {object} body
 * @param {{partial?: boolean}} opts partial=true (PATCH) — only provided keys validated/returned.
 */
export function validateEventFields(body, { partial = true } = {}) {
  const issues = []
  const b = body && typeof body === 'object' ? body : {}
  const out = {}
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k)
  const provided = (k) => !partial || has(k)

  if (provided('eventName')) {
    const v = str(b.eventName)
    if (!v) issues.push('Event name is required.')
    else if (v.length > MAX.eventName) issues.push('Event name is too long.')
    out.eventName = v
  }

  if (provided('eventDate')) {
    const v = dateOrNull(b.eventDate)
    if (Number.isNaN(v)) issues.push('Event date is invalid.')
    out.eventDate = v
  }
  if (provided('bookingDeadline')) {
    const v = dateOrNull(b.bookingDeadline)
    if (Number.isNaN(v)) issues.push('Booking deadline is invalid.')
    out.bookingDeadline = v
  }
  if (provided('cancellationDeadline')) {
    const v = dateOrNull(b.cancellationDeadline)
    if (Number.isNaN(v)) issues.push('Cancellation deadline is invalid.')
    out.cancellationDeadline = v
  }

  for (const [key, label, max] of [['venue', 'Venue', MAX.venue]]) {
    if (provided(key)) {
      const v = isEmpty(b[key]) ? null : str(b[key])
      if (v && v.length > max) issues.push(`${label} is too long.`)
      out[key] = v
    }
  }

  for (const key of ['eventDateIsTentative', 'venueIsConfirmed', 'isBookingsOpen']) {
    if (has(key)) {
      if (typeof b[key] !== 'boolean') issues.push(`${key} must be true or false.`)
      out[key] = b[key]
    }
  }

  if (provided('capacity')) {
    const n = intOrNull(b.capacity)
    if (n === null || Number.isNaN(n) || !Number.isInteger(n) || n <= 0) issues.push('Capacity must be a whole number greater than zero.')
    out.capacity = n
  }
  if (provided('holdMinutes')) {
    const n = intOrNull(b.holdMinutes)
    if (n === null || Number.isNaN(n) || !Number.isInteger(n) || n <= 0) issues.push('Hold minutes must be a whole number greater than zero.')
    out.holdMinutes = n
  }

  for (const [key, label] of [
    ['regularPriceXcdCents', 'Regular ticket price'],
    ['earlyBirdPriceXcdCents', 'Early Bird price']
  ]) {
    if (provided(key)) {
      const n = intOrNull(b[key])
      if (n === null || Number.isNaN(n) || !Number.isInteger(n) || n < 0) issues.push(`${label} must be a whole number of cents ≥ 0.`)
      out[key] = n
    }
  }
  if (provided('earlyBirdSlots')) {
    const n = intOrNull(b.earlyBirdSlots)
    if (n === null || Number.isNaN(n) || !Number.isInteger(n) || n <= 0) issues.push('Early Bird slot count must be a whole number greater than zero.')
    out.earlyBirdSlots = n
  }
  if (provided('ticketInclusions')) {
    const { issues: i, values } = validateInclusions(b.ticketInclusions, 'Ticket inclusions')
    issues.push(...i)
    out.ticketInclusions = values
  }

  if (provided('promoVideoUrl')) {
    out.promoVideoUrl = isEmpty(b.promoVideoUrl) ? null : str(b.promoVideoUrl)
  }
  if (provided('promoVideoThumbnailUrl')) {
    out.promoVideoThumbnailUrl = isEmpty(b.promoVideoThumbnailUrl) ? null : str(b.promoVideoThumbnailUrl)
  }

  if (provided('topSizeGuide')) {
    const { issues: i, values } = validateSizeGuide(b.topSizeGuide, 'Top size guide', ['bust', 'underbust'])
    issues.push(...i)
    out.topSizeGuide = values
  }
  if (provided('bottomSizeGuide')) {
    const { issues: i, values } = validateSizeGuide(b.bottomSizeGuide, 'Bottom size guide', ['waist', 'hip'])
    issues.push(...i)
    out.bottomSizeGuide = values
  }

  return { issues, fields: out }
}

const RESOLUTIONS = ['confirm', 'cancel']

/** PATCH .../bookings/:id — admin resolution of a 'paid_needs_review' booking, or a cancellation. */
export function validateBookingResolution(body) {
  const issues = []
  const b = body && typeof body === 'object' ? body : {}
  const out = {}

  const resolution = str(b.resolution)
  if (!RESOLUTIONS.includes(resolution)) {
    issues.push(`resolution must be one of: ${RESOLUTIONS.join(', ')}.`)
  }
  out.resolution = resolution

  out.adminNotes = isEmpty(b.adminNotes) ? null : str(b.adminNotes).slice(0, MAX.adminNotes)

  return { issues, fields: out }
}

/**
 * POST /api/bikini-mix/checkout — the customer booking/checkout payload.
 *
 * Shape only. Nothing here is trusted for MONEY, fabric names/hex or event
 * facts — the endpoint re-resolves everything price-related via the
 * claim_bikini_mix_booking() RPC (which decides the early-bird reservation
 * under the event-row lock) and fabric names/hex from `fabrics` by id. This
 * function only confirms the request is well-formed enough to act on.
 *
 * `garmentType` determines which branch of fields is required — exactly
 * one of the two branches, never a mix. One-piece bookings use a single
 * fabric/colour (`onepieceFabricId`) and have no bottom-style/scrunch
 * concept; bikini bookings are unchanged from before except for the new
 * `bottomScrunch` flag.
 */
export function validateBookingCheckout(body) {
  const issues = []
  const b = body && typeof body === 'object' ? body : {}
  const out = {}

  if (!isUuid(b.checkoutIdempotencyKey)) issues.push('checkoutIdempotencyKey must be a UUID.')
  out.checkoutIdempotencyKey = isUuid(b.checkoutIdempotencyKey) ? b.checkoutIdempotencyKey : null

  const garmentType = str(b.garmentType)
  if (!GARMENT_TYPES.includes(garmentType)) issues.push(`garmentType must be one of: ${GARMENT_TYPES.join(', ')}.`)
  out.garmentType = garmentType

  if (garmentType === 'bikini') {
    if (!SIZES.includes(str(b.topSize))) issues.push(`topSize must be one of: ${SIZES.join(', ')}.`)
    out.topSize = str(b.topSize)
    if (!SIZES.includes(str(b.bottomSize))) issues.push(`bottomSize must be one of: ${SIZES.join(', ')}.`)
    out.bottomSize = str(b.bottomSize)

    if (!BOTTOM_STYLES.includes(str(b.bottomStyle))) issues.push(`bottomStyle must be one of: ${BOTTOM_STYLES.join(', ')}.`)
    out.bottomStyle = str(b.bottomStyle)
    if (!BOTTOM_COVERAGES.includes(str(b.bottomCoverage))) issues.push(`bottomCoverage must be one of: ${BOTTOM_COVERAGES.join(', ')}.`)
    out.bottomCoverage = str(b.bottomCoverage)

    out.bottomScrunch = b.bottomScrunch === true

    for (const key of ['leftFabricId', 'rightFabricId', 'bottomFabricId']) {
      if (!isUuid(b[key])) issues.push(`${key} must be a UUID.`)
      out[key] = isUuid(b[key]) ? b[key] : null
    }
    out.onepieceSize = null
    out.onepieceCoverage = null
    out.onepieceFabricId = null
  } else if (garmentType === 'onepiece') {
    if (!SIZES.includes(str(b.onepieceSize))) issues.push(`onepieceSize must be one of: ${SIZES.join(', ')}.`)
    out.onepieceSize = str(b.onepieceSize)
    if (!BOTTOM_COVERAGES.includes(str(b.onepieceCoverage))) issues.push(`onepieceCoverage must be one of: ${BOTTOM_COVERAGES.join(', ')}.`)
    out.onepieceCoverage = str(b.onepieceCoverage)
    if (!isUuid(b.onepieceFabricId)) issues.push('onepieceFabricId must be a UUID.')
    out.onepieceFabricId = isUuid(b.onepieceFabricId) ? b.onepieceFabricId : null

    out.topSize = null
    out.bottomSize = null
    out.bottomStyle = null
    out.bottomCoverage = null
    out.bottomScrunch = false
    out.leftFabricId = null
    out.rightFabricId = null
    out.bottomFabricId = null
  } else {
    // garmentType itself already failed validation above — still populate
    // every key so downstream code never sees `undefined`.
    out.topSize = null
    out.bottomSize = null
    out.bottomStyle = null
    out.bottomCoverage = null
    out.bottomScrunch = false
    out.leftFabricId = null
    out.rightFabricId = null
    out.bottomFabricId = null
    out.onepieceSize = null
    out.onepieceCoverage = null
    out.onepieceFabricId = null
  }

  const fullName = str(b.fullName)
  if (!fullName) issues.push('Full name is required.')
  else if (fullName.length > MAX.name) issues.push('Full name is too long.')
  out.fullName = fullName

  const email = str(b.email)
  if (!email) issues.push('Email is required.')
  else if (!EMAIL_RE.test(email)) issues.push('Enter a valid email address.')
  else if (email.length > MAX.email) issues.push('Email is too long.')
  out.email = email

  const whatsapp = str(b.whatsapp)
  const phoneDigits = whatsapp.replace(/\D/g, '')
  if (!whatsapp) issues.push('Phone number is required.')
  else if (phoneDigits.length < 7) issues.push('Enter a valid phone number.')
  else if (whatsapp.length > MAX.phone) issues.push('Phone number is too long.')
  out.whatsapp = whatsapp

  out.marketingOptIn = b.marketingOptIn === true

  if (b.termsAccepted !== true) issues.push('You must agree to the cancellation and refund policy.')

  // Measurements — every field optional; validated only when provided.
  for (const [key, label] of [
    ['bustInches', 'Bust'],
    ['underbustInches', 'Underbust'],
    ['waistInches', 'Waist'],
    ['hipsInches', 'Hips']
  ]) {
    const n = measurementOrNull(b[key])
    if (Number.isNaN(n) || (n != null && (n < MEASUREMENT_MIN || n > MEASUREMENT_MAX))) {
      issues.push(`${label} must be a realistic measurement in inches (between ${MEASUREMENT_MIN} and ${MEASUREMENT_MAX}), or left blank.`)
      out[key] = null
    } else {
      out[key] = n
    }
  }

  return { issues, fields: out }
}

/**
 * Admin writes to a bikini_mix_fabrics eligibility row — mirrors the
 * existing is_active toggle, now with a second independent flag.
 */
export function validateFabricEligibilityFields(body, { partial = true } = {}) {
  const issues = []
  const b = body && typeof body === 'object' ? body : {}
  const out = {}
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k)
  const provided = (k) => !partial || has(k)

  if (provided('isActive')) {
    if (typeof b.isActive !== 'boolean') issues.push('isActive must be true or false.')
    out.isActive = b.isActive
  }
  if (provided('eligibleForOnepiece')) {
    if (typeof b.eligibleForOnepiece !== 'boolean') issues.push('eligibleForOnepiece must be true or false.')
    out.eligibleForOnepiece = b.eligibleForOnepiece
  }

  return { issues, fields: out }
}

/** Admin writes to a bikini_mix_gallery_images row (create or update). */
export function validateGalleryImageFields(body, { partial = false } = {}) {
  const issues = []
  const b = body && typeof body === 'object' ? body : {}
  const out = {}
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k)
  const provided = (k) => !partial || has(k)

  if (provided('category')) {
    const v = str(b.category)
    if (!GALLERY_CATEGORIES.includes(v)) issues.push(`category must be one of: ${GALLERY_CATEGORIES.join(', ')}.`)
    out.category = v
  }
  if (provided('caption')) {
    const v = isEmpty(b.caption) ? null : str(b.caption)
    if (v && v.length > MAX.caption) issues.push('Caption is too long.')
    out.caption = v
  }
  if (has('includedInTicket')) {
    if (typeof b.includedInTicket !== 'boolean') issues.push('includedInTicket must be true or false.')
    out.includedInTicket = b.includedInTicket
  } else if (!partial) {
    out.includedInTicket = false
  }
  if (has('isActive')) {
    if (typeof b.isActive !== 'boolean') issues.push('isActive must be true or false.')
    out.isActive = b.isActive
  } else if (!partial) {
    out.isActive = true
  }
  if (provided('sortOrder')) {
    const n = intOrNull(b.sortOrder)
    if (n !== null && (Number.isNaN(n) || !Number.isInteger(n))) issues.push('sortOrder must be a whole number.')
    out.sortOrder = n
  }

  return { issues, fields: out }
}
