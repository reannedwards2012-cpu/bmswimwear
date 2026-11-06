/**
 * POST /api/admin/fabrics/bulk-delete     body: { ids: string[] }
 *
 * Admin-only. Permanently deletes a batch of fabrics — but ONLY those not
 * referenced by anything that would otherwise be silently affected:
 *
 *   - `product_fabrics` (a fabric currently offered on a product)
 *   - `bikini_mix_bookings` (left_fabric_id / right_fabric_id /
 *     bottom_fabric_id / onepiece_fabric_id — a real guest's booking still
 *     points at this fabric; that FK is `on delete set null`, which would
 *     silently clear a live reference on a real booking row)
 *
 * A referenced fabric is SKIPPED and reported with why, never deleted and
 * never allowed to fail the whole batch — the admin is pointed at
 * deactivating it instead (bulk-status.post.js, isActive: false).
 *
 * `orders` / `order_items` are deliberately NOT checked: order_items stores
 * a text SNAPSHOT of the fabric id/name at purchase time, not a live
 * foreign key (confirmed against the live schema — same convention as
 * server/api/admin/products/[id].delete.js's order_items comment), so a
 * historical order can never be affected by a fabric being deleted.
 *
 * Capped at MAX_BULK_IDS per call. Every id must be a well-formed UUID —
 * the whole request is rejected (400) if any one isn't. Mirrors the
 * single-fabric endpoint's cleanup order: product_fabrics links first (for
 * whichever ids turn out to have none — a no-op, but kept for parity),
 * then the fabric rows, then best-effort Storage image cleanup.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { FABRIC_IMAGE_BUCKET, pathFromPublicUrl } from '../../../utils/fabricImages.js'
import { isMigrationNotAppliedError } from '../../../utils/bikiniMixMigrationGuard.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BOOKING_FABRIC_COLUMNS = ['left_fabric_id', 'right_fabric_id', 'bottom_fabric_id', 'onepiece_fabric_id']
export const MAX_BULK_IDS = 100

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const rawIds = Array.isArray(body?.ids) ? body.ids : null

  if (!rawIds || rawIds.length === 0) {
    setResponseStatus(event, 400)
    return { error: 'Provide at least one fabric id to delete.' }
  }
  if (rawIds.length > MAX_BULK_IDS) {
    setResponseStatus(event, 400)
    return { error: `You can delete at most ${MAX_BULK_IDS} fabrics at a time.` }
  }
  const ids = [...new Set(rawIds)]
  if (ids.some((id) => typeof id !== 'string' || !UUID_RE.test(id))) {
    setResponseStatus(event, 400)
    return { error: 'One or more fabric ids are invalid.' }
  }

  try {
    const supabase = supabaseAdmin()

    // ── Reference checks — fail closed: any error here blocks the whole
    //    batch rather than guessing which ids are actually safe. ──
    const { data: linkRows, error: linkError } = await supabase.from('product_fabrics').select('fabric_id').in('fabric_id', ids)
    if (linkError) {
      console.error('[admin/fabrics] bulk-delete product_fabrics check failed:', linkError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not check fabric usage. Nothing was deleted.' }
    }
    const productCounts = new Map()
    for (const row of linkRows ?? []) {
      productCounts.set(row.fabric_id, (productCounts.get(row.fabric_id) ?? 0) + 1)
    }

    const orFilter = BOOKING_FABRIC_COLUMNS.map((col) => `${col}.in.(${ids.join(',')})`).join(',')
    const { data: bookingRows, error: bookingError } = await supabase
      .from('bikini_mix_bookings')
      .select(BOOKING_FABRIC_COLUMNS.join(','))
      .or(orFilter)

    // A missing/not-yet-migrated bikini_mix_bookings table is treated the
    // same as "no bookings reference anything" (nothing to protect against
    // yet) — any OTHER error still fails closed.
    const migrationMissing = bookingError && isMigrationNotAppliedError(bookingError)
    if (bookingError && !migrationMissing) {
      console.error('[admin/fabrics] bulk-delete bikini_mix_bookings check failed:', bookingError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not check fabric usage. Nothing was deleted.' }
    }

    const bookingRefs = new Set()
    if (!migrationMissing) {
      for (const row of bookingRows ?? []) {
        for (const col of BOOKING_FABRIC_COLUMNS) {
          if (row[col] && ids.includes(row[col])) bookingRefs.add(row[col])
        }
      }
    }

    const skipped = []
    const eligibleIds = []
    for (const id of ids) {
      if (productCounts.has(id)) {
        const n = productCounts.get(id)
        skipped.push({ id, reason: `in use by ${n} product${n === 1 ? '' : 's'}` })
      } else if (bookingRefs.has(id)) {
        skipped.push({ id, reason: 'referenced by a Swimsuit Mixer booking' })
      } else {
        eligibleIds.push(id)
      }
    }

    let deletedRows = []
    if (eligibleIds.length) {
      // Explicit cleanup first — same reasoning as the single-fabric
      // endpoint: never assumed, never left to a cascade that may not exist.
      const { error: cleanupError } = await supabase.from('product_fabrics').delete().in('fabric_id', eligibleIds)
      if (cleanupError) {
        console.error('[admin/fabrics] bulk-delete product_fabrics cleanup failed:', cleanupError.message)
        setResponseStatus(event, 500)
        return { error: 'Could not delete the selected fabrics.' }
      }

      const { data: deleted, error: deleteError } = await supabase
        .from('fabrics')
        .delete()
        .in('id', eligibleIds)
        .select('id, image_url')
      if (deleteError) {
        console.error('[admin/fabrics] bulk-delete failed:', deleteError.message)
        setResponseStatus(event, 500)
        return { error: 'Could not delete the selected fabrics.' }
      }
      deletedRows = deleted ?? []

      const storagePaths = deletedRows.map((r) => pathFromPublicUrl(r.image_url)).filter(Boolean)
      if (storagePaths.length) {
        const { error: storageError } = await supabase.storage.from(FABRIC_IMAGE_BUCKET).remove(storagePaths)
        if (storageError) console.error('[admin/fabrics] bulk-delete image cleanup failed:', storageError.message)
      }
    }

    return { ok: true, deletedCount: deletedRows.length, requestedCount: ids.length, skipped }
  } catch (err) {
    console.error('[admin/fabrics] unexpected bulk-delete error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not delete the selected fabrics.' }
  }
})
