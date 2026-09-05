/**
 * Server-side validation + sanitisation for a public website inquiry
 * (server/api/inquiries.post.js) and the admin PATCH
 * (server/api/admin/inquiries/[id].patch.js).
 *
 * Pure module — no Nitro / Supabase imports — so it can be unit-tested
 * directly (matches server/utils/checkoutOrder.js / adminNotes.js).
 *
 * Nothing here trusts client formatting: control characters are stripped,
 * whitespace collapsed, every field hard length-capped. The message is only
 * ever rendered as plain text downstream, so this is storage hygiene, not an
 * XSS defence — but a message is still never allowed to carry control bytes.
 */
import { INQUIRY_SUBJECTS } from '../../data/constants.js'

export const INQUIRY_STATUSES = ['new', 'open', 'responded', 'closed']

// The hidden form field a bot fills in. A non-empty value => silently drop.
export const HONEYPOT_FIELD = 'company'

export const MAX = {
  firstName: 80,
  lastName: 80,
  email: 160,
  phone: 40,
  subject: 120,
  message: 4000,
  adminNotes: 5000
}
export const MIN = { message: 2 }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// ASCII control characters except TAB (\x09) and LF (\x0A).
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g

const str = (v) => (typeof v === 'string' ? v : '')

/** Strip control chars (keep \n, \t), normalise CRLF -> LF, trim. */
const cleanText = (v) =>
  str(v)
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS_RE, '')
    .trim()

/** Single-line field: collapse every whitespace run to one space. */
const cleanLine = (v) => cleanText(v).replace(/\s+/g, ' ')

/** Message body: keep line breaks, collapse 3+ consecutive newlines to 2. */
const cleanBody = (v) => cleanText(v).replace(/\n{3,}/g, '\n\n')

/**
 * Validate + sanitise an inbound public inquiry payload.
 *
 * @returns {{ ok: true, fields: {firstName,lastName,email,phone,subject,message} }
 *          | { ok: false, issues: string[] }}
 */
export function validateInquiry(body) {
  const b = body && typeof body === 'object' ? body : {}
  const issues = []

  const firstName = cleanLine(b.firstName)
  if (!firstName) issues.push('Please enter your first name.')
  else if (firstName.length > MAX.firstName) issues.push('First name is too long.')

  const lastName = cleanLine(b.lastName)
  if (lastName.length > MAX.lastName) issues.push('Last name is too long.')

  const email = cleanLine(b.email).toLowerCase()
  if (!email) issues.push('Please enter your email address.')
  else if (email.length > MAX.email || !EMAIL_RE.test(email)) issues.push('Please enter a valid email address.')

  // phone: optional. Normalise to "+<digits>" / "<digits>" (drop spaces,
  // brackets, dashes) so the admin inquiry list's digit-run phone search
  // actually matches — same approach as manual orders.
  const phoneRaw = cleanLine(b.phone)
  let phone = phoneRaw ? (phoneRaw.trimStart().startsWith('+') ? '+' : '') + phoneRaw.replace(/\D/g, '') : ''
  if (phone.length > MAX.phone) issues.push('Phone number is too long.')
  if (!phone || phone === '+') phone = null

  // subject: coerce anything unrecognised to 'Other' rather than rejecting
  const rawSubject = cleanLine(b.subject)
  const subject = INQUIRY_SUBJECTS.includes(rawSubject) ? rawSubject : 'Other'

  const message = cleanBody(b.message)
  if (!message) issues.push('Please enter a message.')
  else if (message.length < MIN.message) issues.push('Your message is too short.')
  else if (message.length > MAX.message) issues.push('Your message is too long — please keep it under 4000 characters.')

  if (issues.length) return { ok: false, issues }
  return {
    ok: true,
    fields: { firstName, lastName: lastName || null, email, phone, subject, message }
  }
}

/** True when the honeypot field carries any non-whitespace value. */
export function isHoneypotTripped(body) {
  const b = body && typeof body === 'object' ? body : {}
  return cleanLine(b[HONEYPOT_FIELD]).length > 0
}

/**
 * Admin status update. `undefined` (key absent) => "leave it alone".
 * @returns {{ ok: true, value: string|undefined } | { ok: false, error: string }}
 */
export function normalizeInquiryStatus(raw) {
  if (raw === undefined) return { ok: true, value: undefined }
  if (typeof raw !== 'string' || !INQUIRY_STATUSES.includes(raw)) {
    return { ok: false, error: `Status must be one of: ${INQUIRY_STATUSES.join(', ')}.` }
  }
  return { ok: true, value: raw }
}

/**
 * Private admin notes. String or null/undefined only; trimmed; empty => null;
 * over the cap => rejected. `undefined` (key absent) => "leave it alone".
 * @returns {{ ok: true, value: string|null|undefined } | { ok: false, error: string }}
 */
export function normalizeInquiryNotes(raw) {
  if (raw === undefined) return { ok: true, value: undefined }
  if (raw === null) return { ok: true, value: null }
  if (typeof raw !== 'string') return { ok: false, error: 'Notes must be text.' }
  const trimmed = cleanText(raw)
  if (!trimmed) return { ok: true, value: null }
  if (trimmed.length > MAX.adminNotes) {
    return { ok: false, error: `Notes must be ${MAX.adminNotes} characters or fewer.` }
  }
  return { ok: true, value: trimmed }
}
