/**
 * GET /api/admin/orders
 *
 * Admin-only. Returns a safe list of orders (newest first), optionally
 * filtered by status. Never returns payment tokens/idempotency keys/user_id
 * or other internals — see server/utils/orderMappers.js for the whitelist.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { ORDER_STATUSES } from '../../../utils/orderStatus.js'
import { mapOrderListItem } from '../../../utils/orderMappers.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const query = getQuery(event)
  const statusFilter = typeof query.status === 'string' ? query.status : ''

  if (statusFilter && !ORDER_STATUSES.includes(statusFilter)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid status filter.' }
  }

  try {
    const supabase = supabaseAdmin()

    let q = supabase
      .from('orders')
      .select('id, order_number, created_at, first_name, last_name, email, subtotal_usd_cents, status, delivery_method, paid_at')
      .order('created_at', { ascending: false })

    if (statusFilter) q = q.eq('status', statusFilter)

    const { data, error } = await q

    if (error) {
      console.error('[admin/orders] list query failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load orders.' }
    }

    return { orders: (data ?? []).map(mapOrderListItem) }
  } catch (err) {
    console.error('[admin/orders] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load orders.' }
  }
})
