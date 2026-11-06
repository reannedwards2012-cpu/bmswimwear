/**
 * POST /api/admin/orders/bulk-status     body: { ids: string[], status: string }
 *
 * Admin-only. Bulk version of PATCH /api/admin/orders/:id/status, with one
 * deliberate restriction beyond the single-order endpoint: target status
 * 'paid' is ALWAYS rejected here, for every order regardless of source.
 * Marking an order paid is a financial assertion (for a manual order, it's
 * literally the payment record, optionally capturing a payment method) —
 * that stays a one-at-a-time, reviewed action, never a bulk one. Every
 * other transition is validated per row exactly like the single endpoint
 * (orderStatus.js's adminTransitionsFor, same optimistic-concurrency guard
 * on the current status), so a batch with mixed sources/current-statuses
 * applies the update only to rows for which it's actually valid — anything
 * else is skipped and reported, never silently dropped or allowed to fail
 * the whole batch.
 *
 * Capped at MAX_BULK_IDS per call. Every id must be a well-formed UUID.
 *
 * Isolated: writes only `public.orders.status` (+ `updated_at`, same as the
 * single endpoint's pre-existing DB trigger).
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { ORDER_STATUSES, adminTransitionsFor, isAdminVisibleOrder } from '../../../utils/orderStatus.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MAX_BULK_IDS = 100

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const rawIds = Array.isArray(body?.ids) ? body.ids : null
  const nextStatus = typeof body?.status === 'string' ? body.status.trim() : ''

  if (!nextStatus || !ORDER_STATUSES.includes(nextStatus)) {
    setResponseStatus(event, 400)
    return { error: 'A valid target status is required.' }
  }
  // Hard rule, independent of source — never a bulk action.
  if (nextStatus === 'paid') {
    setResponseStatus(event, 400)
    return { error: 'Orders can’t be marked paid in bulk — review and update each one individually.' }
  }
  if (!rawIds || rawIds.length === 0) {
    setResponseStatus(event, 400)
    return { error: 'Provide at least one order id.' }
  }
  if (rawIds.length > MAX_BULK_IDS) {
    setResponseStatus(event, 400)
    return { error: `You can update at most ${MAX_BULK_IDS} orders at a time.` }
  }
  const ids = [...new Set(rawIds)]
  if (ids.some((id) => typeof id !== 'string' || !UUID_RE.test(id))) {
    setResponseStatus(event, 400)
    return { error: 'One or more order ids are invalid.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: rows, error: findError } = await supabase.from('orders').select('id, source, status').in('id', ids)
    if (findError) {
      console.error('[admin/orders] bulk-status lookup failed:', findError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update the selected orders.' }
    }

    const found = new Map((rows ?? []).map((r) => [r.id, r]))
    const skipped = []
    const eligible = []

    for (const id of ids) {
      const row = found.get(id)
      if (!row) {
        skipped.push({ id, reason: 'not found' })
        continue
      }
      if (!isAdminVisibleOrder(row.source, row.status)) {
        skipped.push({ id, reason: 'abandoned checkout, not a visible order' })
        continue
      }
      const allowed = adminTransitionsFor(row.source, row.status)
      if (!allowed.includes(nextStatus)) {
        skipped.push({ id, reason: `"${row.status}" can't move to "${nextStatus}"` })
        continue
      }
      eligible.push(row)
    }

    // Per-row update, each guarded by its OWN current status (optimistic
    // concurrency, same as the single endpoint) — a batch can mix sources
    // and current statuses, so this can't be one blanket WHERE clause.
    let updatedCount = 0
    for (const row of eligible) {
      const { data: updated, error: updateError } = await supabase
        .from('orders')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('status', row.status)
        .select('id')

      if (updateError) {
        console.error('[admin/orders] bulk-status update failed for', row.id, '—', updateError.message)
        skipped.push({ id: row.id, reason: 'update failed' })
      } else if (!updated?.length) {
        skipped.push({ id: row.id, reason: 'changed since it was loaded — refresh and retry' })
      } else {
        updatedCount++
      }
    }

    return { ok: true, updatedCount, requestedCount: ids.length, skipped }
  } catch (err) {
    console.error('[admin/orders] unexpected bulk-status error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update the selected orders.' }
  }
})
