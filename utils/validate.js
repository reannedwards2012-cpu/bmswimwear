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
