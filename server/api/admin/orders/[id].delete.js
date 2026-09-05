/**
 * DELETE /api/admin/orders/:id
 *
 * Admin-only, permanent — MANUAL orders only. A website order can NEVER be
 * hard-deleted through this endpoint (400), independent of the UI: website
 * orders (especially paid Go2Pay ones) use Archive
 * (PATCH /api/admin/orders/:id/archive) / cancellation / status management.
 *
 * Deleting a manual order:
 *  - removes its order_items via ON DELETE CASCADE (verified)
 *  - best-effort removes any 'order-images' Storage objects it owns
 *    (catalogue static image paths are never sent to Storage)
 *  - touches nothing else — products, fabrics, customer accounts unaffected
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { isManualSource } from '../../../utils/orderStatus.js'
import { formatOrderNumber } from '../../../utils/orderMappers.js'
import { ORDER_IMAGE_BUCKET, orderImagePathFromPublicUrl } from '../../../utils/orderImages.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid order id.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: order, error: readError } = await supabase
      .from('orders')
      .select('id, order_number, source, order_items ( image )')
      .eq('id', id)
      .maybeSingle()

    if (readError) {
      console.error('[admin/orders] delete lookup failed:', readError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not delete this order.' }
    }
    if (!order) {
      setResponseStatus(event, 404)
      return { error: 'Order not found.' }
    }

    // Hard rule, independent of the UI: website orders are never hard-deleted.
    if (!isManualSource(order.source)) {
      setResponseStatus(event, 400)
      return { error: 'Website orders can’t be deleted. Archive the order instead.' }
    }

    const storagePaths = (order.order_items ?? [])
      .map((it) => orderImagePathFromPublicUrl(it.image))
      .filter(Boolean)

    const { error: delError } = await supabase.from('orders').delete().eq('id', id)
    if (delError) {
      console.error('[admin/orders] delete failed:', delError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not delete this order.' }
    }

    if (storagePaths.length) {
      const { error: storageError } = await supabase.storage.from(ORDER_IMAGE_BUCKET).remove(storagePaths)
      if (storageError) console.error('[admin/orders] order-image cleanup failed:', storageError.message)
    }

    return { ok: true, orderNumber: formatOrderNumber(order.order_number) }
  } catch (err) {
    console.error('[admin/orders] unexpected delete error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not delete this order.' }
  }
})
