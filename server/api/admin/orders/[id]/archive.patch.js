/**
 * PATCH /api/admin/orders/:id/archive     body: { archived: boolean }
 *
 * Admin-only. Website/Go2Pay orders are NEVER hard-deleted — this is how an
 * admin tidies them out of the working Orders view instead.
 *
 *   { archived: true }  -> archived_at = now()
 *   { archived: false } -> archived_at = null   (Restore)
 *
 * The application writes EXACTLY ONE column (`archived_at`). It never touches
 * status, paid_at, order_items, Go2Pay ids, payment_id, notes, customer
 * details, source, or anything else. It can never delete a row.
 *
 * NOTE: `public.orders` has a pre-existing unconditional BEFORE UPDATE trigger
 * that sets `updated_at = now()` on every row update, so `updated_at` still
 * moves. That timestamp is not displayed in the admin UI and is used by no
 * logic (analytics key on paid_at / created_at). See the implementation report
 * for the optional one-line trigger tweak if you want archive to leave it
 * untouched too.
 *
 * Guards:
 *  - requireAdmin
 *  - valid UUID
 *  - order must exist (404)
 *  - order must be a WEBSITE order (400 for manual — those are deleted, not archived)
 *  - order must be an admin-visible order, i.e. not an abandoned checkout (404)
 *
 * `status` and its transition authority are untouched — Archive is a separate
 * presentation flag, not a status.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { isArchivableSource, isAdminVisibleOrder } from '../../../../utils/orderStatus.js'
import { ORDER_DETAIL_SELECT, mapOrderDetail, formatOrderNumber } from '../../../../utils/orderMappers.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid order id.' }
  }

  const body = await readBody(event).catch(() => null)
  if (typeof body?.archived !== 'boolean') {
    setResponseStatus(event, 400)
    return { error: 'Body must be { archived: true | false }.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: current, error: findError } = await supabase
      .from('orders')
      .select('id, order_number, source, status, archived_at')
      .eq('id', id)
      .maybeSingle()

    if (findError) {
      console.error('[admin/orders] archive lookup failed:', findError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update this order.' }
    }
    if (!current) {
      setResponseStatus(event, 404)
      return { error: 'Order not found.' }
    }

    // Website-only. Manual orders are deleted, not archived.
    if (!isArchivableSource(current.source)) {
      setResponseStatus(event, 400)
      return { error: 'Only website orders can be archived. Manual orders are deleted instead.' }
    }

    // Can't archive/restore something that isn't a visible order in the first
    // place (an abandoned website checkout attempt).
    if (!isAdminVisibleOrder(current.source, current.status)) {
      setResponseStatus(event, 404)
      return { error: 'Order not found.' }
    }

    // The app writes EXACTLY ONE column. (A pre-existing DB trigger still
    // touches updated_at — see the file header.) No status, no payment data,
    // nothing else.
    const { error: updateError } = await supabase
      .from('orders')
      .update({ archived_at: body.archived ? new Date().toISOString() : null })
      .eq('id', id)

    if (updateError) {
      console.error('[admin/orders] archive update failed:', updateError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update this order.' }
    }

    const { data: full, error: reloadError } = await supabase
      .from('orders')
      .select(ORDER_DETAIL_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (reloadError || !full) {
      console.error('[admin/orders] archive post-update reload failed:', reloadError?.message)
      // The write succeeded; report success without the fresh row.
      return { ok: true, orderNumber: formatOrderNumber(current.order_number), archived: body.archived }
    }

    return { ok: true, order: mapOrderDetail(full) }
  } catch (err) {
    console.error('[admin/orders] unexpected archive error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update this order.' }
  }
})
