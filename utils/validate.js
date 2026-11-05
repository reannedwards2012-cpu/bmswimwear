// Same email pattern used server-side (server/utils/checkoutOrder.js,
// newsletterSubscribe.js, inquiryValidation.js, stockistValidation.js) —
// kept as a client-safe copy since server/ isn't in the client bundle.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email) {
  return EMAIL_RE.test(String(email || '').trim())
}

// Same rule as server/utils/checkoutOrder.js's phone check: at least 7
// digits once everything else (spaces, dashes, parens, +) is stripped.
export function isValidPhone(phone) {
  return String(phone || '').replace(/\D/g, '').length >= 7
}

// Swimsuit Mixer body measurements (bust/underbust/waist/hips, inches) —
// same range as server/utils/bikiniMixValidation.js's measurementOrNull, a
// broad sanity bound rather than a tight clinical one. Blank is always
// valid (every measurement is optional) — only a non-blank, out-of-range,
// or non-numeric value is invalid.
export const MEASUREMENT_MIN_INCHES = 10
export const MEASUREMENT_MAX_INCHES = 120
export function isValidMeasurement(value) {
  const v = String(value ?? '').trim()
  if (!v) return true
  const n = Number(v)
  return Number.isFinite(n) && n >= MEASUREMENT_MIN_INCHES && n <= MEASUREMENT_MAX_INCHES
}
