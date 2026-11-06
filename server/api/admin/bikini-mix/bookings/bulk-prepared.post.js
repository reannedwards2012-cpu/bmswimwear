/**
 * POST /api/admin/bikini-mix/bookings/bulk-prepared     body: { ids: string[], prepared: boolean }
 *
 * Admin-only. Bulk version of PATCH .../bookings/:id/prepared — the ONLY
 * bulk action offered for Swimsuit Mixer bookings. `base_prepared_at` is a
 * purely operational production-checklist flag, never read by any payment,
 * capacity, or booking-status logic — exactly like the single-booking
 * endpoint, this never touches status, payment, or guest details, and only
 * ever applies to a 'confirmed' booking. Anything else in the selection
 * (pending/needs-review/cancelled/expired) is SKIPPED and reported, never
 * silently dropped or allowed to fail the whole batch.
 *
 * Deliberately excluded from this round, per the brief: bulk payment
 * confirmation, cancellation, or refunds. Those stay one-at-a-time,
 * reviewed actions on the existing booking-detail business logic.
 *
 * Capped at MAX_BULK_IDS per call. Every id must be a well-formed UUID.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MAX_BULK_IDS = 100

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const rawIds = Array.isArray(body?.ids) ? body.ids : null
  const prepared = body?.prepared

  if (typeof prepared !== 'boolean') {
    setResponseStatus(event, 400)
    return { error: '"prepared" must be a boolean.' }
  }
  if (!rawIds || rawIds.length === 0) {
    setResponseStatus(event, 400)
    return { error: 'Provide at least one booking id.' }
  }
  if (rawIds.length > MAX_BULK_IDS) {
    setResponseStatus(event, 400)
    return { error: `You can update at most ${MAX_BULK_IDS} bookings at a time.` }
  }
  const ids = [...new Set(rawIds)]
  if (ids.some((id) => typeof id !== 'string' || !UUID_RE.test(id))) {
    setResponseStatus(event, 400)
    return { error: 'One or more booking ids are invalid.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: rows, error: findError } = await supabase.from('bikini_mix_bookings').select('id, status').in('id', ids)
    if (findError) {
      console.error('[admin/bikini-mix/bookings] bulk-prepared lookup failed:', findError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update preparation status.' }
    }

    const found = new Map((rows ?? []).map((r) => [r.id, r]))
    const skipped = []
    const eligibleIds = []
    for (const id of ids) {
      const row = found.get(id)
      if (!row) {
        skipped.push({ id, reason: 'not found' })
      } else if (row.status !== 'confirmed') {
        skipped.push({ id, reason: 'only a confirmed booking can be marked as prepared' })
      } else {
        eligibleIds.push(id)
      }
    }

    let updatedCount = 0
    if (eligibleIds.length) {
      const { data: updated, error: updateError } = await supabase
        .from('bikini_mix_bookings')
        .update({ base_prepared_at: prepared ? new Date().toISOString() : null })
        .in('id', eligibleIds)
        .eq('status', 'confirmed')
        .select('id')

      if (updateError) {
        console.error('[admin/bikini-mix/bookings] bulk-prepared update failed:', updateError.message)
        setResponseStatus(event, 500)
        return { error: 'Could not update preparation status.' }
      }
      updatedCount = updated?.length ?? 0
    }

    return { ok: true, updatedCount, requestedCount: ids.length, skipped }
  } catch (err) {
    console.error('[admin/bikini-mix/bookings] unexpected bulk-prepared error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update preparation status.' }
  }
})
