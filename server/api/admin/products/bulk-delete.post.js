/**
 * POST /api/admin/products/bulk-delete     body: { ids: string[] }
 *
 * Admin-only. Permanently deletes a batch of products — but ONLY those not
 * referenced by anything that would otherwise be silently affected:
 *
 *   - the standing Test Product (slug 'test-product') — never deletable,
 *     same rule as the single-product endpoint.
 *   - `stockist_inventory_items.product_id` (on delete set null) — a real
 *     stockist's inventory record still points at this product; deleting
 *     it would silently clear that live link (the item's own snapshot
 *     fields stay intact, but the link itself would be lost).
 *
 * `order_items` is deliberately NOT checked: product_id there is a text
 * SNAPSHOT at purchase time, not a live foreign key (see the single-product
 * delete endpoint's own header comment, which documents this from the live
 * schema) — a historical order can never be affected by this.
 *
 * A referenced/protected product is SKIPPED and reported with why, never
 * deleted and never allowed to fail the whole batch — the admin is pointed
 * at deactivating it instead (bulk-status.post.js, isActive: false).
 * product_sizes / product_coverages / product_details / product_images /
 * this product's own product_fabrics links all cascade automatically on
 * delete (same as the single-product endpoint) — those are the product's
 * own child rows, not independent protected records.
 *
 * Capped at MAX_BULK_IDS per call. Every id must be a well-formed UUID.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { PRODUCT_IMAGE_BUCKET, productImagePathFromPublicUrl } from '../../../utils/productImages.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MAX_BULK_IDS = 100

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const rawIds = Array.isArray(body?.ids) ? body.ids : null

  if (!rawIds || rawIds.length === 0) {
    setResponseStatus(event, 400)
    return { error: 'Provide at least one product id to delete.' }
  }
  if (rawIds.length > MAX_BULK_IDS) {
    setResponseStatus(event, 400)
    return { error: `You can delete at most ${MAX_BULK_IDS} products at a time.` }
  }
  const ids = [...new Set(rawIds)]
  if (ids.some((id) => typeof id !== 'string' || !UUID_RE.test(id))) {
    setResponseStatus(event, 400)
    return { error: 'One or more product ids are invalid.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: products, error: findError } = await supabase
      .from('products')
      .select('id, slug, product_images(image_url)')
      .in('id', ids)
    if (findError) {
      console.error('[admin/products] bulk-delete lookup failed:', findError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not delete the selected products.' }
    }
    const found = new Map((products ?? []).map((p) => [p.id, p]))

    // Fail closed on the reference check — never guess which ids are safe.
    const { data: stockistRows, error: stockistError } = await supabase
      .from('stockist_inventory_items')
      .select('product_id')
      .in('product_id', ids)
    if (stockistError) {
      console.error('[admin/products] bulk-delete stockist-reference check failed:', stockistError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not check product usage. Nothing was deleted.' }
    }
    const stockistRefs = new Set((stockistRows ?? []).map((r) => r.product_id))

    const skipped = []
    const eligible = []
    for (const id of ids) {
      const product = found.get(id)
      if (!product) {
        skipped.push({ id, reason: 'not found' })
      } else if (product.slug === 'test-product') {
        skipped.push({ id, reason: 'the Test Product can’t be deleted' })
      } else if (stockistRefs.has(id)) {
        skipped.push({ id, reason: 'referenced by a stockist’s inventory' })
      } else {
        eligible.push(product)
      }
    }

    let deletedCount = 0
    if (eligible.length) {
      const eligibleIds = eligible.map((p) => p.id)
      const { data: deleted, error: deleteError } = await supabase.from('products').delete().in('id', eligibleIds).select('id')
      if (deleteError) {
        console.error('[admin/products] bulk-delete failed:', deleteError.message)
        setResponseStatus(event, 500)
        return { error: 'Could not delete the selected products.' }
      }
      deletedCount = deleted?.length ?? 0

      const storagePaths = eligible
        .flatMap((p) => (p.product_images ?? []).map((i) => productImagePathFromPublicUrl(i.image_url)))
        .filter(Boolean)
      if (storagePaths.length) {
        const { error: storageError } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove(storagePaths)
        if (storageError) console.error('[admin/products] bulk-delete storage cleanup failed:', storageError.message)
      }
    }

    return { ok: true, deletedCount, requestedCount: ids.length, skipped }
  } catch (err) {
    console.error('[admin/products] unexpected bulk-delete error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not delete the selected products.' }
  }
})
