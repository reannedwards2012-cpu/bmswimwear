/**
 * Post-inquiry emails: a customer acknowledgment + an admin notification to
 * hello@bmswimwear.com.
 *
 * Called by server/api/inquiries.post.js ONLY after the inquiry has been
 * successfully stored, and NEVER for a honeypot or rejected submission (the
 * endpoint returns before reaching here in those cases).
 *
 * Best-effort: every failure is logged with a safe label and swallowed. The
 * inquiry is already saved — a mail failure must not change the endpoint's
 * `{ ok: true }` response.
 */
import { sendTransactionalEmail, BREVO_REPLY_TO } from './brevo.js'
import { inquiryAckEmail, inquiryAdminEmail } from './emailTemplates.js'

const ADMIN_EMAIL = 'hello@bmswimwear.com'

/**
 * @param {{ id?:string|number, firstName?:string, lastName?:string, email:string,
 *           phone?:string|null, subject?:string, message?:string }} inquiry
 */
export async function sendInquiryEmails(inquiry = {}) {
  const tasks = []

  // ── Customer acknowledgment ──────────────────────────────────────────────
  if (inquiry.email) {
    const ack = inquiryAckEmail({ firstName: inquiry.firstName })
    tasks.push(
      sendTransactionalEmail({
        to: inquiry.email,
        subject: ack.subject,
        html: ack.html,
        text: ack.text,
        tags: ['inquiry-ack']
      }).then((r) => {
        if (!r.ok) console.error('[inquiry-email] customer acknowledgment failed:', r.error)
      })
    )
  }

  // ── Admin notification ───────────────────────────────────────────────────
  // Reply-To is set to the customer so a reply straight from the hello@ inbox
  // (read in Zoho) goes back to them.
  const adm = inquiryAdminEmail(inquiry)
  const customerName = [inquiry.firstName, inquiry.lastName].filter(Boolean).join(' ').trim()
  tasks.push(
    sendTransactionalEmail({
      to: ADMIN_EMAIL,
      subject: adm.subject,
      html: adm.html,
      text: adm.text,
      replyTo: inquiry.email
        ? { email: inquiry.email, ...(customerName ? { name: customerName } : {}) }
        : BREVO_REPLY_TO,
      tags: ['inquiry-admin']
    }).then((r) => {
      if (!r.ok) console.error('[inquiry-email] admin notification failed:', r.error)
    })
  )

  try {
    await Promise.allSettled(tasks)
  } catch (err) {
    console.error('[inquiry-email] unexpected error:', err && err.message)
  }
}
