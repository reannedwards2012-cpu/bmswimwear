/**
 * Optional marketing opt-in from the checkout page.
 *
 * This is NOT a second newsletter system — it's a thin adapter over the
 * existing path (server/utils/newsletterSubscribe.js → Brevo List #3). The
 * List #3 Brevo Automation owns the marketing welcome; nothing transactional
 * is sent here, and a Brevo problem must NEVER fail an otherwise valid
 * checkout / order / payment.
 *
 * The consent is captured at checkout and PERSISTED on the order
 * (orders.marketing_opt_in). The Brevo subscription itself is applied ONLY
 * after the Go2Pay callback has authoritatively verified the order as paid —
 * `maybeSyncPaidOrderMarketing` below. It never runs at pending-order creation,
 * and never for an abandoned / payment_failed / cancelled order.
 *
 * Best-effort: every failure is swallowed and logged.
 */
import { subscribeToNewsletter } from './newsletterSubscribe.js'
import { upsertContact, NEWSLETTER_LIST_ID } from './brevo.js'

const defaultSubscribe = (args) =>
  subscribeToNewsletter(args, {
    upsertContact: (a) => upsertContact({ ...a, listIds: [NEWSLETTER_LIST_ID] })
  })

/**
 * @param {{ email: string, optIn: boolean }} input
 * @param {{ subscribe?: (a:{email:string}) => Promise<{ok:boolean,status?:string}> }} [deps]
 * @returns {Promise<{ ok:boolean, skipped?:boolean, status?:string, error?:string }>}
 */
export async function subscribeAtCheckout({ email, optIn } = {}, deps = {}) {
  if (optIn !== true) return { ok: false, skipped: true }
  if (!email) return { ok: false, skipped: true }

  const subscribe = deps.subscribe || defaultSubscribe
  try {
    const r = await subscribe({ email })
    if (!r || !r.ok) {
      console.error('[checkout] marketing opt-in not applied:', r && r.status)
      return { ok: false, status: r && r.status }
    }
    return { ok: true, status: r.status }
  } catch (err) {
    console.error('[checkout] marketing opt-in threw:', err && err.message)
    return { ok: false, error: err && err.message }
  }
}

/**
 * Apply a PAID website order's persisted checkout marketing opt-in to Brevo
 * List #3. Called from the Go2Pay callback AFTER verifyAndMarkPaid has
 * authoritatively observed the order as paid.
 *
 * Idempotency: an atomic guarded UPDATE claims `orders.marketing_synced_at`
 * (written as the caller's ISO-timestamp lease value). Exactly one worker wins
 *   status = 'paid' AND source = 'website' AND marketing_opt_in = true
 *   AND marketing_synced_at IS NULL
 * so repeated Go2Pay callbacks are no-ops, and a pending / payment_failed /
 * cancelled / non-opted-in / manual order matches nothing. On a Brevo failure
 * the marker is released (ownership-guarded) so a later callback retries — the
 * Brevo upsert is itself idempotent, so a retry is harmless.
 *
 * Best-effort: NEVER throws. A Brevo problem cannot affect payment
 * verification, paid status, callback success or the order-confirmation email.
 * No transactional welcome is sent — the List #3 Automation owns that.
 *
 * @param supabase       service-role client
 * @param {string} orderId
 * @param {{ subscribe?: Function }} [deps]  test seam, forwarded to subscribeAtCheckout
 */
export async function maybeSyncPaidOrderMarketing(supabase, orderId, deps = {}) {
  try {
    const leaseValue = new Date().toISOString()

    const claim = await supabase
      .from('orders')
      .update({ marketing_synced_at: leaseValue })
      .eq('id', orderId)
      .eq('status', 'paid')
      .eq('source', 'website')
      .eq('marketing_opt_in', true)
      .is('marketing_synced_at', null)
      .select('email')

    if (claim.error) {
      console.error('[checkout-marketing] claim failed:', claim.error.message)
      return
    }
    if (!claim.data || !claim.data.length) {
      // not opted in / not a paid website order / already synced (or in flight)
      return
    }

    const email = claim.data[0].email
    if (!email) return

    const r = await subscribeAtCheckout({ email, optIn: true }, deps)

    if (!r || !r.ok) {
      // Release our claim (only if we still hold it) so the next Go2Pay
      // callback retries the (idempotent) upsert.
      const rel = await supabase
        .from('orders')
        .update({ marketing_synced_at: null })
        .eq('id', orderId)
        .eq('marketing_synced_at', leaseValue)
        .select('id')
      if (rel.error) console.error('[checkout-marketing] release failed:', rel.error.message)
      else console.error(`[checkout-marketing] Brevo upsert failed for order ${orderId} — will retry on next callback`)
    }
  } catch (err) {
    console.error('[checkout-marketing] unexpected error:', err && err.message)
  }
}
