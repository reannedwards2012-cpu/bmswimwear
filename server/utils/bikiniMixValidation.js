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
  personalization: 60
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PACKAGES = ['classic_mix', 'the_works']
const BOTTOM_STYLES = ['tie-side', 'classic']
const BOTTOM_COVERAGES = ['bikini', 'cheeky']

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
    ['classicMixPriceXcdCents', 'Classic Mix price'],
    ['theWorksPriceXcdCents', 'The Works price']
  ]) {
    if (provided(key)) {
      const n = intOrNull(b[key])
      if (n === null || Number.isNaN(n) || !Number.isInteger(n) || n < 0) issues.push(`${label} must be a whole number of cents ≥ 0.`)
      out[key] = n
    }
  }

  if (provided('classicMixInclusions')) {
    const { issues: i, values } = validateInclusions(b.classicMixInclusions, 'Classic Mix inclusions')
    issues.push(...i)
    out.classicMixInclusions = values
  }
  if (provided('theWorksInclusions')) {
    const { issues: i, values } = validateInclusions(b.theWorksInclusions, 'The Works inclusions')
    issues.push(...i)
    out.theWorksInclusions = values
  }

  if (provided('promoVideoUrl')) {
    out.promoVideoUrl = isEmpty(b.promoVideoUrl) ? null : str(b.promoVideoUrl)
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
 * facts — the endpoint re-resolves retail_price_xcd_cents from the live
 * `bikini_mix_event` row and fabric names/hex from `fabrics` by id, exactly
 * like server/utils/checkoutOrder.js does for product orders. This function
 * only confirms the request is well-formed enough to act on.
 */
export function validateBookingCheckout(body) {
  const issues = []
  const b = body && typeof body === 'object' ? body : {}
  const out = {}

  if (!isUuid(b.checkoutIdempotencyKey)) issues.push('checkoutIdempotencyKey must be a UUID.')
  out.checkoutIdempotencyKey = isUuid(b.checkoutIdempotencyKey) ? b.checkoutIdempotencyKey : null

  const pkg = str(b.package)
  if (!PACKAGES.includes(pkg)) issues.push(`package must be one of: ${PACKAGES.join(', ')}.`)
  out.package = pkg

  if (!SIZES.includes(str(b.topSize))) issues.push(`topSize must be one of: ${SIZES.join(', ')}.`)
  out.topSize = str(b.topSize)
  if (!SIZES.includes(str(b.bottomSize))) issues.push(`bottomSize must be one of: ${SIZES.join(', ')}.`)
  out.bottomSize = str(b.bottomSize)

  if (!BOTTOM_STYLES.includes(str(b.bottomStyle))) issues.push(`bottomStyle must be one of: ${BOTTOM_STYLES.join(', ')}.`)
  out.bottomStyle = str(b.bottomStyle)
  if (!BOTTOM_COVERAGES.includes(str(b.bottomCoverage))) issues.push(`bottomCoverage must be one of: ${BOTTOM_COVERAGES.join(', ')}.`)
  out.bottomCoverage = str(b.bottomCoverage)

  for (const key of ['leftFabricId', 'rightFabricId', 'bottomFabricId']) {
    if (!isUuid(b[key])) issues.push(`${key} must be a UUID.`)
    out[key] = isUuid(b[key]) ? b[key] : null
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

  const personalizationName = isEmpty(b.personalizationName) ? '' : str(b.personalizationName)
  if (pkg === 'the_works' && !personalizationName) issues.push('Personalization name is required for The Works.')
  if (personalizationName.length > MAX.personalization) issues.push('Personalization name is too long.')
  out.personalizationName = personalizationName || null

  out.marketingOptIn = b.marketingOptIn === true

  if (b.termsAccepted !== true) issues.push('You must agree to the cancellation and refund policy.')

  return { issues, fields: out }
}
