/**
 * GET /api/admin/orders/:id
 *
 * Admin-only. Returns the full operational detail for one order — enough to
 * fulfil it — as a safe field whitelist (server/utils/orderMappers.js).
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { ORDER_DETAIL_SELECT, mapOrderDetail } from '../../../utils/orderMappers.js'
import { isAdminVisibleOrder } from '../../../utils/orderStatus.js'
import { signOrderImageUrl, orderImagePathFromPublicUrl } from '../../../utils/orderImages.js'

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

    const { data, error } = await supabase.from('orders').select(ORDER_DETAIL_SELECT).eq('id', id).maybeSingle()

    if (error) {
      console.error('[admin/orders] detail query failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load order.' }
    }
    if (!data) {
      setResponseStatus(event, 404)
      return { error: 'Order not found.' }
    }

    // An abandoned website checkout attempt (pending / payment_failed website
    // row) is not a visible admin order — same rule as the list. Nothing in
    // the admin UI links here for one of those, so treat a direct hit as 404.
    if (!isAdminVisibleOrder(data.source, data.status)) {
      setResponseStatus(event, 404)
      return { error: 'Order not found.' }
    }

    const order = mapOrderDetail(data)

    // Phase 2: 'order-images' is a private bucket — a stored URL pointing
    // into it is only ever a path to resolve, never something servable
    // as-is. Only items that actually reference THAT bucket are touched;
    // a catalogue item's `image` is a static site asset (/images/products/…)
    // or a different, still-public bucket (product-images) and is passed
    // through completely unchanged — orderImagePathFromPublicUrl() only
    // matches 'order-images' URLs, so this can't accidentally blank a
    // catalogue thumbnail. Each match is resolved from THIS already-admin-
    // gated, id-scoped order's own row — never a client-supplied path — so
    // a signed URL for one customer's reference image can never be minted
    // via a guessed/modified id for another's.
    if (order.items?.length) {
      const signedImages = await Promise.all(order.items.map((it) => signOrderImageUrl(supabase, it.image)))
      order.items = order.items.map((it, i) => ({
        ...it,
        image: orderImagePathFromPublicUrl(it.image) ? signedImages[i] : it.image
      }))
    }

    return { order }
  } catch (err) {
    console.error('[admin/orders] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load order.' }
  }
})
