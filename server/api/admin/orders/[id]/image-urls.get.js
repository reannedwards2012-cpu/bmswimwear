/**
 * GET /api/admin/orders/:id/image-urls
 *
 * Admin-only. Phase 2 follow-up — a lightweight refresh endpoint that
 * returns ONLY this order's item images, each freshly signed, as
 * { images: [{ id, image }] }. Exists so the admin order-detail page can
 * silently renew expiring signed URLs on a timer without re-fetching (or
 * risking clobbering) anything else on the page — notably the unsaved
 * admin-notes draft, which is reactively re-seeded whenever the FULL order
 * object changes identity (see pages/admin/orders/[id].vue). This endpoint
 * never touches that, or anything but images.
 *
 * Scoped exactly like GET /api/admin/orders/:id: id-validated, admin-gated,
 * and every image resolved only from THIS order's own just-fetched row —
 * never a client-supplied path/bucket.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { isAdminVisibleOrder } from '../../../../utils/orderStatus.js'
import { signOrderImageUrl, orderImagePathFromPublicUrl } from '../../../../utils/orderImages.js'

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

    const { data, error } = await supabase
      .from('orders')
      .select('id, source, status, order_items ( id, image )')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[admin/orders/image-urls] query failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not refresh images.' }
    }
    if (!data || !isAdminVisibleOrder(data.source, data.status)) {
      setResponseStatus(event, 404)
      return { error: 'Order not found.' }
    }

    const items = data.order_items ?? []
    // Same catalogue-passthrough rule as the main detail endpoint: only a
    // genuine order-images reference gets re-signed, everything else keeps
    // whatever value it already had.
    const signed = await Promise.all(items.map((it) => signOrderImageUrl(supabase, it.image)))
    const images = items.map((it, i) => ({
      id: it.id,
      image: orderImagePathFromPublicUrl(it.image) ? signed[i] : it.image
    }))

    return { images }
  } catch (err) {
    console.error('[admin/orders/image-urls] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not refresh images.' }
  }
})
