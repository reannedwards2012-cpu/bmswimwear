/**
 * GET /api/account/orders
 *
 * Requires a valid Supabase access token (Authorization: Bearer …). Returns the
 * signed-in customer's own orders, newest first, as a STRICT safe-field
 * whitelist — no internal UUIDs, user_id, payment_id, callback token, checkout
 * idempotency key, Go2Pay request/order ids, payment URL or provider internals.
 *
 * Before listing, any historical GUEST order (`user_id IS NULL`) whose email
 * matches this account's *verified* Supabase email is linked to the account —
 * see server/utils/claimGuestOrders.js. Idempotent, server-side, never trusts
 * a client-supplied email, never touches anything but `orders.user_id`.
 *
 * Manual orders linked to the account appear here too. `currency` + the
 * currency's subtotal ARE exposed (needed to render a price correctly).
 * Still NOT exposed, conservatively: `source`, `payment_method`,
 * `admin_notes`, a custom item's `description`, and a custom item's
 * reference `image` (nulled).
 */
import { supabaseAdmin } from '../../utils/supabaseAdmin.js'
import { requireUser } from '../../utils/authUser.js'
import { claimGuestOrdersForUser } from '../../utils/claimGuestOrders.js'

const displayNumber = (n) => `BM-${String(n).padStart(6, '0')}`

export default defineEventHandler(async (event) => {
  const user = await requireUser(event) // throws 401 if not authenticated

  try {
    const supabase = supabaseAdmin()

    // Auto-link past guest orders placed with this account's *verified* email.
    // Best-effort: a failure here just means those orders link on a later
    // request (the operation is idempotent) — it never blocks the listing.
    if (user.emailVerified && user.email) {
      try {
        await claimGuestOrdersForUser(supabase, user.id, user.email)
      } catch (claimErr) {
        console.error('[account/orders] guest-order claim skipped:', claimErr?.message)
      }
    }

    const { data, error } = await supabase
      .from('orders')
      .select(
        `order_number,
         created_at,
         status,
         currency,
         subtotal_usd_cents,
         subtotal_xcd_cents,
         delivery_method,
         order_items (
           product_name,
           image,
           is_custom,
           quantity,
           size,
           colour_name,
           coverage,
           unit_price_usd_cents,
           unit_price_xcd_cents
         )`
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[account/orders] query failed:', error.message)
      setResponseStatus(event, 500)
      return { orders: [] }
    }

    const orders = (data ?? []).map((o) => ({
      orderNumber: displayNumber(o.order_number),
      createdAt: o.created_at,
      status: o.status,
      currency: o.currency ?? 'USD',
      subtotalUsdCents: o.subtotal_usd_cents,
      subtotalXcdCents: o.subtotal_xcd_cents,
      deliveryMethod: o.delivery_method,
      items: (o.order_items ?? []).map((it) => ({
        productName: it.product_name,
        // never surface a custom-order reference/design image to the customer
        image: it.is_custom ? null : it.image,
        quantity: it.quantity,
        size: it.size ?? null,
        colour: it.colour_name ?? null,
        coverage: it.coverage ?? null,
        unitPriceUsdCents: it.unit_price_usd_cents,
        unitPriceXcdCents: it.unit_price_xcd_cents
      }))
    }))

    return { orders }
  } catch (err) {
    console.error('[account/orders] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { orders: [] }
  }
})
