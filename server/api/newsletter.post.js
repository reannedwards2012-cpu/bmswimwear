/**
 * POST /api/newsletter   (public — no auth)
 *
 * Wires the homepage "Join our Email List" form to Brevo. Validates + normalises
 * the email server-side and adds/updates the contact on the opt-in list (ID 3).
 *
 * That is the website's ENTIRE job. It does NOT send a welcome email: the
 * welcome is a Brevo Automation triggered by joining List #3, so the marketing
 * subscription (and its unsubscribe) is owned entirely by Brevo and the
 * transactional channel used by order/inquiry emails is never touched.
 *
 * Abuse protection, consistent with the inquiry endpoint's spirit:
 *   1. Honeypot — a filled hidden `company` field ⇒ fake success, do nothing.
 *   2. Best-effort per-instance rate limit (soft flood guard only; see below).
 *   3. Server-side email validation.
 *
 * Brevo is NEVER exposed to the browser. The API key stays in server/utils/brevo.js.
 *
 * Duplicate signups are treated as success. A Brevo contact-sync failure is a
 * 502 (never a false "you're subscribed").
 */
import { subscribeToNewsletter } from '../utils/newsletterSubscribe.js'
import { upsertContact, NEWSLETTER_LIST_ID } from '../utils/brevo.js'

const HONEYPOT_FIELD = 'company'
const GENERIC_ERROR = 'We couldn’t sign you up right now. Please try again in a moment.'

// ── Best-effort rate limit ────────────────────────────────────────────────
// Netlify runs many short-lived function instances, so this in-memory map is a
// soft per-instance flood guard only — it never persists anything and never
// blocks a legitimate first submission. The honeypot, server-side validation
// and Brevo's own dedupe are the real gates. (Deliberately NOT the DB-backed
// inquiry_rate_hits table — that stays isolated to the inquiry flow.)
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 5
const hits = new Map() // ip -> number[] (recent timestamps)

function rateLimited(ip) {
  if (!ip) return false
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)

  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      const keep = v.filter((t) => now - t < WINDOW_MS)
      if (keep.length) hits.set(k, keep)
      else hits.delete(k)
    }
  }
  return recent.length > MAX_PER_WINDOW
}

function clientIp(event) {
  const nf = getRequestHeader(event, 'x-nf-client-connection-ip')
  if (nf && nf.trim()) return nf.trim()
  const xff = getRequestHeader(event, 'x-forwarded-for')
  if (xff && xff.trim()) return xff.split(',')[0].trim()
  try {
    const ip = getRequestIP(event, { xForwardedFor: true })
    return ip ? String(ip).trim() : null
  } catch {
    return null
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null)
  const b = body && typeof body === 'object' ? body : {}

  // 1. Honeypot — pretend it worked, do nothing.
  if (typeof b[HONEYPOT_FIELD] === 'string' && b[HONEYPOT_FIELD].trim()) {
    return { ok: true }
  }

  // 2. Soft rate limit.
  if (rateLimited(clientIp(event))) {
    setResponseStatus(event, 429)
    return { ok: false, error: 'You’ve tried a few times — please wait a moment and try again.' }
  }

  // 3. Subscribe (validate → add/update contact on list 3).
  const result = await subscribeToNewsletter(
    { email: b.email },
    { upsertContact: (args) => upsertContact({ ...args, listIds: [NEWSLETTER_LIST_ID] }) }
  )

  if (result.status === 'invalid') {
    setResponseStatus(event, 400)
    return { ok: false, error: 'Please enter a valid email address.' }
  }

  if (!result.ok) {
    setResponseStatus(event, 502)
    return { ok: false, error: GENERIC_ERROR }
  }

  return { ok: true }
})
