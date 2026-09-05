/**
 * PATCH /api/admin/orders/:id/status
 *
 * Admin-only. Moves an order between operational statuses.
 *
 * WEBSITE orders: target 'paid' is ALWAYS rejected (only the Go2Pay callback
 * in server/utils/go2payVerify.js may set it, tied to independent
 * verification + paid_at). Every other transition must appear in
 * WEBSITE_STATUS_TRANSITIONS for the current status.
 *
 * MANUAL orders (source ≠ 'website'): payment happened outside the website
 * flow, so `pending → paid` is allowed here — it sets `paid_at = now()` and,
 * optionally, `payment_method` from the body. No fake Go2Pay ids are ever
 * written. Other transitions follow MANUAL_STATUS_TRANSITIONS.
 *
 * The update is guarded on the status read moments earlier
 * (`.eq('status', current.status)`), so a concurrent change is a no-op (409)
 * instead of a silent clobber.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { adminTransitionsFor, isManualSource, isAdminVisibleOrder } from '../../../../utils/orderStatus.js'
import { ORDER_DETAIL_SELECT, mapOrderDetail } from '../../../../utils/orderMappers.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PAYMENT_METHODS = ['cash', 'bank_transfer', 'payment_link', 'other']

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid order id.' }
  }

  const body = await readBody(event).catch(() => null)
  const nextStatus = typeof body?.status === 'string' ? body.status.trim() : ''
  if (!nextStatus) {
    setResponseStatus(event, 400)
    return { error: 'A target status is required.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: current, error: findError } = await supabase
      .from('orders')
      .select('id, status, source')
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

    // Defense-in-depth: an abandoned website checkout attempt isn't a visible
    // admin order, so it can't be transitioned here either (the transition
    // maps already forbid every move out of website `pending`, but this keeps
    // the visibility rule in one place).
    if (!isAdminVisibleOrder(current.source, current.status)) {
      setResponseStatus(event, 404)
      return { error: 'Order not found.' }
    }

    const manual = isManualSource(current.source)

    // Hard rule for website orders: nothing reaches 'paid' by hand, ever.
    if (nextStatus === 'paid' && !manual) {
      setResponseStatus(event, 400)
      return { error: 'Website orders can only be marked paid by a verified Go2Pay payment.' }
    }

    const allowedTargets = adminTransitionsFor(current.source, current.status)
    if (!allowedTargets.includes(nextStatus)) {
      setResponseStatus(event, 400)
      return {
        error: `"${current.status}" orders cannot be moved to "${nextStatus}".`,
        currentStatus: current.status,
        allowedTransitions: allowedTargets
      }
    }

    const patch = { status: nextStatus, updated_at: new Date().toISOString() }

    // Manual pending → paid: this endpoint IS the payment record for a
    // manual order. Set paid_at now; accept an optional payment_method.
    if (nextStatus === 'paid' && manual) {
      patch.paid_at = new Date().toISOString()
      if (body?.paymentMethod != null && body.paymentMethod !== '') {
        const pm = String(body.paymentMethod).trim()
        if (!PAYMENT_METHODS.includes(pm)) {
          setResponseStatus(event, 400)
          return { error: `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}.` }
        }
        patch.payment_method = pm
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('orders')
      .update(patch)
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
