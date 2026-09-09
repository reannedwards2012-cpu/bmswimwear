/**
 * Server-only Brevo client — transactional email + contacts.
 *
 * `BREVO_API_KEY` is read straight from process.env here. It is NEVER placed in
 * Nuxt runtimeConfig (public or private), never rendered, never returned to the
 * browser and never logged. Only code under server/ imports this module, and
 * server/ is bundled into the Nitro function, not the client.
 *
 * Every export is best-effort and NEVER throws: the callers (inquiry endpoint,
 * Go2Pay callback, newsletter endpoint) must not fail their primary job just
 * because an email or a contact sync failed. Failures come back as
 * `{ ok: false, ... }` and are logged with safe fields only — HTTP status and
 * Brevo's own error `code`, never the payload, the recipient list or the key.
 */

const BASE_URL = 'https://api.brevo.com/v3'
const TIMEOUT_MS = 8000

// ── Centralised sender identity ─────────────────────────────────────────────
// The Brevo domain-authenticated, verified sender for this site. Every email
// goes out as this; replies come back to the same inbox (read from Zoho).
export const BREVO_SENDER = { name: 'Bahama Mama Swimwear', email: 'hello@bmswimwear.com' }
export const BREVO_REPLY_TO = { email: 'hello@bmswimwear.com' }

// The single opt-in newsletter list. Inquiry customers and order customers are
// NEVER added here — subscription is strictly explicit, from the homepage form.
export const NEWSLETTER_LIST_ID = 3

function apiKey() {
  const key = process.env.BREVO_API_KEY
  return typeof key === 'string' && key.trim() ? key.trim() : null
}

/** Whether Brevo is configured at all (key present). */
export const brevoConfigured = () => !!apiKey()

async function brevoFetch(path, { method = 'POST', body } = {}) {
  const key = apiKey()
  if (!key) {
    console.error('[brevo] BREVO_API_KEY not configured — skipping', method, path)
    return { ok: false, status: 0, data: null, error: 'not-configured' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'api-key': key,
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    })

    // 204 No Content (e.g. an existing contact updated) carries no body.
    let data = null
    if (res.status !== 204) data = await res.json().catch(() => null)

    if (!res.ok) {
      // Brevo error envelope is { code, message } — code is safe to log.
      console.error(
        `[brevo] ${method} ${path} failed — HTTP ${res.status}`,
        data && data.code ? `(${data.code})` : ''
      )
      return { ok: false, status: res.status, data, error: (data && data.code) || `http-${res.status}` }
    }
    return { ok: true, status: res.status, data, error: null }
  } catch (err) {
    const reason = err && err.name === 'AbortError' ? 'timeout' : (err && err.message) || 'network-error'
    console.error(`[brevo] ${method} ${path} error — ${reason}`)
    return { ok: false, status: 0, data: null, error: reason }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Send one transactional email (inquiry acknowledgment / admin notification,
 * paid-order confirmation / admin notification).
 *
 * NOT used for the newsletter welcome — that is a marketing email owned by a
 * Brevo Automation on List #3, so its unsubscribe stays on the marketing
 * subscription. Anything sent here goes out on the transactional channel.
 *
 * @param {object}   opts
 * @param {string|{email:string,name?:string}|Array} opts.to
 * @param {string}   opts.subject
 * @param {string}  [opts.html]
 * @param {string}  [opts.text]     plain-text fallback (always pass one)
 * @param {object}  [opts.replyTo]  { email, name? } — defaults to BREVO_REPLY_TO
 * @param {string[]}[opts.tags]
 * @returns {Promise<{ ok:boolean, status:number, messageId:string|null, error:string|null }>}
 */
export async function sendTransactionalEmail({ to, subject, html, text, replyTo, tags } = {}) {
  const list = Array.isArray(to) ? to : [to]
  const recipients = list
    .map((r) =>
      typeof r === 'string'
        ? { email: r }
        : r && r.email
          ? { email: r.email, ...(r.name ? { name: r.name } : {}) }
          : null
    )
    .filter(Boolean)

  if (!recipients.length || !subject) {
    console.error('[brevo] sendTransactionalEmail — missing recipient or subject')
    return { ok: false, status: 0, messageId: null, error: 'invalid-request' }
  }

  const payload = {
    sender: BREVO_SENDER,
    to: recipients,
    replyTo: replyTo && replyTo.email ? replyTo : BREVO_REPLY_TO,
    subject,
    ...(html ? { htmlContent: html } : {}),
    ...(text ? { textContent: text } : {}),
    ...(Array.isArray(tags) && tags.length ? { tags } : {})
  }

  const r = await brevoFetch('/smtp/email', { method: 'POST', body: payload })
  return { ok: r.ok, status: r.status, messageId: (r.data && r.data.messageId) || null, error: r.error }
}

/**
 * Create or update a contact, optionally adding them to lists.
 *
 * `updateEnabled: true` makes a duplicate a graceful 204 update rather than a
 * 400 "Contact already exist". `created` is true only on a 201 (brand-new
 * contact) — the newsletter flow uses that to decide whether to send a welcome,
 * so a repeat signup doesn't get a repeat welcome.
 *
 * @returns {Promise<{ ok:boolean, status:number, created:boolean, error:string|null }>}
 */
export async function upsertContact({ email, attributes, listIds } = {}) {
  if (!email) return { ok: false, status: 0, created: false, error: 'invalid-request' }

  const payload = {
    email,
    updateEnabled: true,
    ...(attributes && typeof attributes === 'object' ? { attributes } : {}),
    ...(Array.isArray(listIds) && listIds.length ? { listIds } : {})
  }

  const r = await brevoFetch('/contacts', { method: 'POST', body: payload })
  return { ok: r.ok, status: r.status, created: r.status === 201, error: r.error }
}
