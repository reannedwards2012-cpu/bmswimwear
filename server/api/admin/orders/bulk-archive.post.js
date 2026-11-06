/**
 * POST /api/admin/orders/bulk-archive     body: { ids: string[], archived: boolean }
 *
 * Admin-only. Bulk version of PATCH /api/admin/orders/:id/archive — same
 * rule, applied per id: only a WEBSITE order that is admin-visible (not an
 * abandoned checkout) can be archived/restored. Each id is checked
 * individually and ids that don't qualify are SKIPPED and reported, never
 * silently dropped or allowed to fail the whole batch. The app still writes
 * exactly one column (`archived_at`) per row — no status, payment, or
 * other field is ever touched here.
 *
 * Capped at MAX_BULK_IDS per call. Every id must be a well-formed UUID —
 * the whole request is rejected (400) if any one isn't.
 *
 * Isolated: writes only `public.orders.archived_at`.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { isArchivableSource, isAdminVisibleOrder } from '../../../utils/orderStatus.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MAX_BULK_IDS = 100

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const rawIds = Array.isArray(body?.ids) ? body.ids : null
  const archived = body?.archived

  if (typeof archived !== 'boolean') {
    setResponseStatus(event, 400)
    return { error: 'Body must include { archived: true | false }.' }
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

    const { data: rows, error: findError } = await supabase
      .from('orders')
      .select('id, order_number, source, status, archived_at')
      .in('id', ids)

    if (findError) {
      console.error('[admin/orders] bulk-archive lookup failed:', findError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update the selected orders.' }
    }

    const found = new Map((rows ?? []).map((r) => [r.id, r]))
    const eligibleIds = []
    const skipped = []

    for (const id of ids) {
      const row = found.get(id)
      if (!row) {
        skipped.push({ id, reason: 'not found' })
      } else if (!isArchivableSource(row.source)) {
        skipped.push({ id, reason: 'manual orders are deleted, not archived' })
      } else if (!isAdminVisibleOrder(row.source, row.status)) {
        skipped.push({ id, reason: 'abandoned checkout, not a visible order' })
      } else if (archived && row.archived_at) {
        skipped.push({ id, reason: 'already archived' })
      } else if (!archived && !row.archived_at) {
        skipped.push({ id, reason: 'already active' })
      } else {
        eligibleIds.push(id)
      }
    }

    let updatedCount = 0
    if (eligibleIds.length) {
      const { data: updated, error: updateError } = await supabase
        .from('orders')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .in('id', eligibleIds)
        .select('id')

      if (updateError) {
        console.error('[admin/orders] bulk-archive update failed:', updateError.message)
        setResponseStatus(event, 500)
        return { error: 'Could not update the selected orders.' }
      }
      updatedCount = updated?.length ?? 0
    }

    return { ok: true, updatedCount, requestedCount: ids.length, skipped }
  } catch (err) {
    console.error('[admin/orders] unexpected bulk-archive error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update the selected orders.' }
  }
})
