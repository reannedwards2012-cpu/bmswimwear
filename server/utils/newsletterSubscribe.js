/**
 * Newsletter opt-in logic, kept as an injectable near-pure function so it can
 * be unit-tested without Nitro. The endpoint (server/api/newsletter.post.js) is
 * a thin wrapper that supplies the real Brevo helper.
 *
 * The website's ONLY job here is: validate the email, then add/update the
 * contact on the opt-in list (deps.upsertContact already binds
 * NEWSLETTER_LIST_ID). It does NOT send a welcome email — that is a Brevo
 * Automation triggered by joining List #3, so Brevo owns the marketing
 * unsubscribe behaviour and it never touches the transactional channel.
 *
 * Rules:
 *  - the email is normalised (trim + lowercase) and format-validated here
 *  - a duplicate is success, not an error (Brevo `updateEnabled` → 204)
 *  - a contact-sync failure ⇒ NOT a success (caller returns 502)
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_EMAIL = 160

export function normalizeEmail(raw) {
  return (typeof raw === 'string' ? raw : '').trim().toLowerCase()
}

export function isValidEmail(email) {
  return !!email && email.length <= MAX_EMAIL && EMAIL_RE.test(email)
}

/**
 * @param {{ email: string }} input
 * @param {{ upsertContact: (a:{email:string})=>Promise<{ok:boolean,created:boolean}> }} deps
 * @returns {Promise<{ ok:boolean, status:'subscribed'|'already'|'invalid'|'failed' }>}
 */
export async function subscribeToNewsletter({ email } = {}, deps = {}) {
  const normalized = normalizeEmail(email)
  if (!isValidEmail(normalized)) {
    return { ok: false, status: 'invalid' }
  }

  const res = await deps.upsertContact({ email: normalized })

  if (!res || !res.ok) {
    // Do NOT tell the visitor they're subscribed when Brevo rejected the sync.
    return { ok: false, status: 'failed' }
  }

  return { ok: true, status: res.created ? 'subscribed' : 'already' }
}
