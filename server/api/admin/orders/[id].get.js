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

    return { order: mapOrderDetail(data) }
  } catch (err) {
    console.error('[admin/orders] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load order.' }
  }
})
