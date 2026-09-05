/**
 * POST /api/inquiries   (public — no auth)
 *
 * The ONLY way a website visitor can create an inquiry. Writes to
 * `public.inquiries` via the service-role client (RLS denies anon entirely).
 * Returns `{ ok: true }` and nothing else — never the row, id, or any stored
 * value.
 *
 * Abuse protection, in order:
 *   1. Honeypot  — a filled hidden field => fake success, store nothing.
 *   2. Rate limit — hashed-IP (only if INQUIRY_HASH_SECRET is set) + per-email,
 *      both DB-backed (serverless-safe). Over the limit => 429.
 *   3. Server-side validation + sanitisation + hard length caps.
 *
 * No raw IP / user-agent is stored. No email is sent (by design, this phase).
 *
 * Isolated: touches only `inquiries` + `inquiry_rate_hits`.
 */
import { supabaseAdmin } from '../utils/supabaseAdmin.js'
import { validateInquiry, isHoneypotTripped } from '../utils/inquiryValidation.js'
import {
  resolveClientIp,
  ipHash,
  checkInquiryRateLimit,
  recordInquiryRateHit
} from '../utils/inquiryRateLimit.js'

const GENERIC_ERROR = 'We couldn’t send your message right now. Please try again in a moment.'

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null)

  // 1. Honeypot — pretend it worked, persist nothing.
  if (isHoneypotTripped(body)) {
    return { ok: true }
  }

  // 2. Validate up-front so a bad email never even reaches the rate check
  //    with a usable key (and so obviously-malformed spam is a cheap 400).
  const result = validateInquiry(body)
  if (!result.ok) {
    setResponseStatus(event, 400)
    return { ok: false, error: 'Please check the form and try again.', issues: result.issues }
  }
  const fields = result.fields

  try {
    const supabase = supabaseAdmin()

    // 3. Rate limit (DB-backed).
    const ipHashValue = ipHash(resolveClientIp(event))
    const gate = await checkInquiryRateLimit(supabase, { ipHashValue, email: fields.email })
    if (!gate.ok) {
      setResponseStatus(event, 429)
      setResponseHeader(event, 'Retry-After', String(gate.retryAfterSeconds))
      return { ok: false, error: 'You’ve sent a few messages already — please wait a little while before sending another.' }
    }

    // 4. Store.
    const { error: insertError } = await supabase.from('inquiries').insert({
      first_name: fields.firstName,
      last_name: fields.lastName,
      email: fields.email,
      phone: fields.phone,
      subject: fields.subject,
      message: fields.message
      // status defaults to 'new'; created_at/updated_at default to now()
    })

    if (insertError) {
      console.error('[inquiries] insert failed:', insertError.message)
      setResponseStatus(event, 500)
      return { ok: false, error: GENERIC_ERROR }
    }

    // 5. Record the accepted submission for the IP signal (best-effort).
    await recordInquiryRateHit(supabase, ipHashValue)

    return { ok: true }
  } catch (err) {
    console.error('[inquiries] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { ok: false, error: GENERIC_ERROR }
  }
})
