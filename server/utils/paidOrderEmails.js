/**
 * Send the website paid-order emails — a customer confirmation and an admin
 * notification to hello@bmswimwear.com — exactly once per order, safely under
 * repeated and/or concurrent Go2Pay callbacks.
 *
 * Called by server/api/payments/go2pay/[token].post.js ONLY after the shared
 * authoritative verifier (server/utils/go2payVerify.js) reports the order in a
 * paid state. Manual / offline orders can never reach this path (no callback
 * token) and are also excluded by the `source = 'website'` guard below.
 *
 * ── Lease protocol ─────────────────────────────────────────────────────────
 * Two columns on `orders`:
 *   • paid_email_sent_at    — DURABLE. Set ONLY after Brevo accepts the customer
 *                             confirmation. Once set, no callback ever sends
 *                             again.
 *   • paid_email_claimed_at — TRANSIENT lease. A worker claims the send by
 *                             writing its own `leaseValue` (an ISO timestamp).
 *                             Every later finalize / release UPDATE is guarded
 *                             by `.eq('paid_email_claimed_at', leaseValue)`, so
 *                             a stale worker can never clear or finalize a
 *                             newer worker's lease.
 *
 * Steps:
 *   1. CLAIM    — atomic conditional UPDATE. Wins only if the row is a paid
 *                 website order, not yet sent, and either unclaimed or holding
 *                 an expired claim (older than LEASE_MS — crash recovery).
 *   2. SEND     — customer confirmation via Brevo.
 *        accepted → FINALIZE: paid_email_sent_at = now(),
 *                             paid_email_claimed_at = NULL   (ownership-guarded)
 *        failed   → RELEASE:  paid_email_claimed_at = NULL   (ownership-guarded)
 *                             ⇒ a later callback retries.
 *   3. ADMIN    — admin notification, best-effort. Its failure is logged for
 *                 manual follow-up and NEVER un-sets the durable marker.
 *
 * Never throws. Never affects the callback's HTTP response to Go2Pay.
 */
import { ORDER_DETAIL_SELECT, formatOrderNumber } from './orderMappers.js'
import { sendTransactionalEmail } from './brevo.js'
import { orderConfirmationEmail, orderAdminEmail } from './emailTemplates.js'
import { siteUrl } from './siteUrl.js'
import { deliveryLabel, zoneLabel } from './shipping.js'

const ADMIN_EMAIL = 'hello@bmswimwear.com'
const LEASE_MS = 3 * 60 * 1000

/**
 * @param supabase  service-role client
 * @param {string} orderId  the `orders.id` UUID
 */
export async function maybeSendPaidOrderEmails(supabase, orderId) {
  try {
    const leaseValue = new Date().toISOString()
    const leaseFloor = new Date(Date.now() - LEASE_MS).toISOString()

    // ── 1. CLAIM ─────────────────────────────────────────────────────────
    // (a) claim an unclaimed row.
    let claim = await supabase
      .from('orders')
      .update({ paid_email_claimed_at: leaseValue })
      .eq('id', orderId)
      .eq('status', 'paid')
      .eq('source', 'website')
      .is('paid_email_sent_at', null)
      .is('paid_email_claimed_at', null)
      .select('id')

    if (claim.error) {
      console.error('[paid-email] claim failed:', claim.error.message)
      return
    }

    // (b) if that matched nothing, the row may hold an EXPIRED claim from a
    //     worker that died mid-send — steal it. A live claim (recent value) is
    //     not < leaseFloor, so a healthy concurrent worker is never disturbed.
    if (!claim.data || !claim.data.length) {
      claim = await supabase
        .from('orders')
        .update({ paid_email_claimed_at: leaseValue })
        .eq('id', orderId)
        .eq('status', 'paid')
        .eq('source', 'website')
        .is('paid_email_sent_at', null)
        .lt('paid_email_claimed_at', leaseFloor)
        .select('id')

      if (claim.error) {
        console.error('[paid-email] expired-claim steal failed:', claim.error.message)
        return
      }
    }

    if (!claim.data || !claim.data.length) {
      // Already sent, or another worker holds a live lease — nothing to do.
      return
    }

    // ── 2. Load the order + items ────────────────────────────────────────
    const { data: order, error: loadErr } = await supabase
      .from('orders')
      .select(ORDER_DETAIL_SELECT)
      .eq('id', orderId)
      .maybeSingle()

    if (loadErr || !order) {
      console.error('[paid-email] order load failed:', (loadErr && loadErr.message) || 'not found')
      await releaseLease(supabase, orderId, leaseValue)
      return
    }

    const view = buildOrderView(order)

    if (!order.email) {
      console.error(
        `[paid-email] ${view.orderNumber} has no customer email — cannot send confirmation; lease released`
      )
      await releaseLease(supabase, orderId, leaseValue)
      return
    }

    // ── 3. Customer confirmation — gates the durable marker ──────────────
    const conf = orderConfirmationEmail(view)
    const custRes = await sendTransactionalEmail({
      to: order.email,
      subject: conf.subject,
      html: conf.html,
      text: conf.text,
      tags: ['order-confirmation']
    })

    if (!custRes.ok) {
      console.error(
        `[paid-email] customer confirmation NOT sent for ${view.orderNumber} (${custRes.error}) — ` +
          'lease released, will retry on the next callback'
      )
      await releaseLease(supabase, orderId, leaseValue)
      return
    }

    // ── FINALIZE — durable + ownership-guarded, atomic ───────────────────
    const fin = await supabase
      .from('orders')
      .update({ paid_email_sent_at: new Date().toISOString(), paid_email_claimed_at: null })
      .eq('id', orderId)
      .eq('paid_email_claimed_at', leaseValue)
      .is('paid_email_sent_at', null)
      .select('id')

    if (fin.error || !fin.data || !fin.data.length) {
      // The customer email DID send. Finalize not applying means our lease was
      // stolen after expiry (send took > LEASE_MS) or already finalized — log
      // loudly. A duplicate is only possible if another worker re-claimed in
      // that window: accepted, rare.
      console.error(
        `[paid-email] customer confirmation SENT for ${view.orderNumber} but finalize did not apply ` +
          `(${(fin.error && fin.error.message) || 'lease no longer owned'})`
      )
    }

    // ── 4. Admin notification — best-effort, gates nothing ───────────────
    let adminUrl = null
    try {
      adminUrl = `${siteUrl()}/admin/orders/${order.id}`
    } catch {
      adminUrl = null
    }

    const adm = orderAdminEmail(view, adminUrl)
    const admRes = await sendTransactionalEmail({
      to: ADMIN_EMAIL,
      subject: adm.subject,
      html: adm.html,
      text: adm.text,
      tags: ['order-admin']
    })

    if (!admRes.ok) {
      console.error(
        `[paid-email] ADMIN notification failed for ${view.orderNumber} (${admRes.error}) — ` +
          'manual follow-up needed; customer confirmation already sent'
      )
    }
  } catch (err) {
    console.error('[paid-email] unexpected error:', err && err.message)
  }
}

/** Clear our own lease so a later callback can retry — only if we still hold it. */
async function releaseLease(supabase, orderId, leaseValue) {
  const r = await supabase
    .from('orders')
    .update({ paid_email_claimed_at: null })
    .eq('id', orderId)
    .eq('paid_email_claimed_at', leaseValue)
    .is('paid_email_sent_at', null)
    .select('id')
  if (r.error) console.error('[paid-email] lease release failed:', r.error.message)
}

/** DB row (ORDER_DETAIL_SELECT shape) → the view the templates consume. */
export function buildOrderView(order) {
  const items = (order.order_items ?? []).map((it) => ({
    name: it.product_name,
    quantity: it.quantity,
    size: it.size || null,
    colour: it.colour_name || null,
    coverage: it.coverage || null
  }))

  const subtotalUsdCents = order.subtotal_usd_cents ?? 0
  const shippingUsdCents = order.shipping_usd_cents ?? 0

  return {
    orderNumber: formatOrderNumber(order.order_number),
    firstName: order.first_name || null,
    lastName: order.last_name || null,
    email: order.email || null,
    phone: order.phone || null,
    items,
    subtotalUsdCents,
    shippingUsdCents,
    // Fall back to subtotal for pre-shipping historical orders (total NULL).
    totalUsdCents: order.total_usd_cents ?? subtotalUsdCents + shippingUsdCents,
    deliveryLabel: deliveryLabel(order.shipping_zone, order.delivery_method),
    zoneLabel: zoneLabel(order.shipping_zone),
    shippingZone: order.shipping_zone ?? null,
    // Address is present for every real delivery (local or international);
    // only legacy 'pickup' rows have none.
    shipping: order.shipping_address1
      ? {
          address1: order.shipping_address1,
          address2: order.shipping_address2,
          city: order.shipping_city,
          region: order.shipping_region,
          postalCode: order.shipping_postal_code,
          country: order.shipping_country
        }
      : null
  }
}
