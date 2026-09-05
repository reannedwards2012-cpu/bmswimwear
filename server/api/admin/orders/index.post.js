/**
 * POST /api/admin/orders
 *
 * Admin-only. Creates a MANUAL order (Instagram / WhatsApp / in-person /
 * other) in the same `orders` table as website orders — never touches
 * Go2Pay. Server-computes the total from the item snapshots in the order's
 * currency; the client-sent total is ignored. See server/utils/manualOrder.js.
 *
 * `source` must be a non-website value (a website order can only be created
 * by POST /api/checkout).
 */
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { buildManualOrder } from '../../../utils/manualOrder.js'
import { fetchCatalogueForCheckout } from '../../../utils/productCatalogue.js'
import { ORDER_DETAIL_SELECT, mapOrderDetail } from '../../../utils/orderMappers.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)

  try {
    const supabase = supabaseAdmin()

    // Authoritative catalogue for any catalogue-type line items.
    const slugs = Array.isArray(body?.items)
      ? body.items
          .filter((it) => it && typeof it === 'object' && it.type !== 'custom')
          .map((it) => (typeof it.productId === 'string' ? it.productId : null))
          .filter(Boolean)
      : []
    const catalogue = await fetchCatalogueForCheckout(supabase, slugs)

    const result = buildManualOrder(body, catalogue)
    if (!result.ok) {
      setResponseStatus(event, 400)
      return { error: result.error, issues: result.issues }
    }

    const { orderRow, itemRows } = result

    // `checkout_idempotency_key` is a unique, non-null column on `orders`
    // (set per website checkout). A manual order never goes through checkout,
    // but still needs a unique value here — a fresh UUID, never a Go2Pay id.
    orderRow.checkout_idempotency_key = randomUUID()

    const { data: order, error: insertError } = await supabase
      .from('orders')
      .insert(orderRow)
      .select('id')
      .single()

    if (insertError || !order) {
      console.error('[admin/orders] manual insert failed:', insertError?.message)
      setResponseStatus(event, 500)
      return { error: 'Could not create the order.' }
    }

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemRows.map((r) => ({ ...r, order_id: order.id })))

    if (itemsError) {
      console.error('[admin/orders] manual items insert failed — rolling back', order.id, itemsError.message)
      await supabase.from('orders').delete().eq('id', order.id)
      setResponseStatus(event, 500)
      return { error: 'Could not create the order.' }
    }

    const { data: full, error: readError } = await supabase
      .from('orders')
      .select(ORDER_DETAIL_SELECT)
      .eq('id', order.id)
      .maybeSingle()

    if (readError || !full) {
      console.error('[admin/orders] manual post-insert read failed:', readError?.message)
      setResponseStatus(event, 500)
      return { error: 'Order created, but could not be re-read.' }
    }

    setResponseStatus(event, 201)
    return { order: mapOrderDetail(full) }
  } catch (err) {
    console.error('[admin/orders] manual create unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not create the order.' }
  }
})
