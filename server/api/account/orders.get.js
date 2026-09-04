/**
 * GET /api/account/orders
 *
 * Requires a valid Supabase access token (Authorization: Bearer …). Returns the
 * signed-in customer's own orders, newest first, as a STRICT safe-field
 * whitelist — no internal UUIDs, user_id, payment_id, callback token, checkout
 * idempotency key, Go2Pay request/order ids, payment URL or provider internals.
 */
import { supabaseAdmin } from '../../utils/supabaseAdmin.js'
import { requireUser } from '../../utils/authUser.js'

const displayNumber = (n) => `BM-${String(n).padStart(6, '0')}`

export default defineEventHandler(async (event) => {
  const user = await requireUser(event) // throws 401 if not authenticated

  try {
    const supabase = supabaseAdmin()

    const { data, error } = await supabase
      .from('orders')
      .select(
        `order_number,
         created_at,
         status,
         subtotal_usd_cents,
         delivery_method,
         order_items (
           product_name,
           image,
           quantity,
           size,
           colour_name,
           coverage,
           unit_price_usd_cents
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
      subtotalUsdCents: o.subtotal_usd_cents,
      deliveryMethod: o.delivery_method,
      items: (o.order_items ?? []).map((it) => ({
        productName: it.product_name,
        image: it.image,
        quantity: it.quantity,
        size: it.size ?? null,
        colour: it.colour_name ?? null,
        coverage: it.coverage ?? null,
        unitPriceUsdCents: it.unit_price_usd_cents
      }))
    }))

    return { orders }
  } catch (err) {
    console.error('[account/orders] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { orders: [] }
  }
})
