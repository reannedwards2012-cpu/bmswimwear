/**
 * PATCH /api/admin/orders/:id/status
 *
 * Admin-only. Moves an order between operational statuses — never touches
 * payment verification. 'paid' is always rejected as a target (only the
 * Go2Pay callback in server/utils/go2payVerify.js may set it, tied to
 * independent verification + paid_at). Every other transition must appear
 * in ADMIN_STATUS_TRANSITIONS for the order's CURRENT status, so e.g. a
 * pending order can't be nudged into 'processing' by hand.
 *
 * The update is guarded on the status read moments earlier
 * (`.eq('status', current.status)`), so a concurrent change — most notably
 * the Go2Pay callback marking the same order paid — makes this a no-op
 * (409) instead of silently clobbering it. paid_at is never written here.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { ADMIN_STATUS_TRANSITIONS } from '../../../../utils/orderStatus.js'
import { ORDER_DETAIL_SELECT, mapOrderDetail } from '../../../../utils/orderMappers.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid order id.' }
  }

  const body = await readBody(event).catch(() => null)
  const nextStatus = typeof body?.status === 'string' ? body.status.trim() : ''

  // Hard rule, independent of the transition map: nothing reaches 'paid'
  // through this endpoint, ever.
  if (nextStatus === 'paid') {
    setResponseStatus(event, 400)
    return { error: 'Orders can only be marked paid by a verified Go2Pay payment.' }
  }
  if (!nextStatus) {
    setResponseStatus(event, 400)
    return { error: 'A target status is required.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: current, error: findError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (findError) {
      console.error('[admin/orders] status lookup failed:', findError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update order status.' }
    }
    if (!current) {
      setResponseStatus(event, 404)
      return { error: 'Order not found.' }
    }

    const allowedTargets = ADMIN_STATUS_TRANSITIONS[current.status] ?? []
    if (!allowedTargets.includes(nextStatus)) {
      setResponseStatus(event, 400)
      return {
        error: `"${current.status}" orders cannot be moved to "${nextStatus}".`,
        currentStatus: current.status,
        allowedTransitions: allowedTargets
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('orders')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', current.status)
      .select('id')

    if (updateError) {
      console.error('[admin/orders] status update failed:', updateError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update order status.' }
    }
    if (!updated?.length) {
      setResponseStatus(event, 409)
      return { error: 'This order changed since it was loaded — please refresh and try again.' }
    }

    const { data: full, error: reloadError } = await supabase
      .from('orders')
      .select(ORDER_DETAIL_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (reloadError || !full) {
      console.error('[admin/orders] post-update reload failed:', reloadError?.message)
      setResponseStatus(event, 500)
      return { error: 'Status updated, but the order could not be re-read.' }
    }

    return { order: mapOrderDetail(full) }
  } catch (err) {
    console.error('[admin/orders] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update order status.' }
  }
})
