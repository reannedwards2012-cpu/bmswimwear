/**
 * DELETE /api/admin/products/:id/images/:imageId
 *
 * Admin-only. Removes one product_images row. If it was the primary image
 * and others remain, the lowest-sort_order survivor is promoted to primary.
 * Best-effort Storage cleanup for a product-images bucket URL (a legacy
 * static /images/... path is left alone — it was never in Storage).
 */
import { supabaseAdmin } from '../../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../../utils/authUser.js'
import { PRODUCT_IMAGE_BUCKET, productImagePathFromPublicUrl } from '../../../../../utils/productImages.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  const imageId = getRouterParam(event, 'imageId')
  if (!id || !UUID_RE.test(id) || !imageId || !UUID_RE.test(imageId)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid id.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: row, error: readErr } = await supabase
      .from('product_images')
      .select('id, image_url, is_primary')
      .eq('id', imageId)
      .eq('product_id', id)
      .maybeSingle()
    if (readErr) {
      console.error('[admin/products/images] delete read failed:', readErr.message)
      setResponseStatus(event, 500)
      return { error: 'Could not remove the image.' }
    }
    if (!row) {
      setResponseStatus(event, 404)
      return { error: 'Image not found.' }
    }

    const { error: delErr } = await supabase.from('product_images').delete().eq('id', imageId).eq('product_id', id)
    if (delErr) {
      console.error('[admin/products/images] delete failed:', delErr.message)
      setResponseStatus(event, 500)
      return { error: 'Could not remove the image.' }
    }

    // Promote a new primary if we just removed the primary.
    if (row.is_primary) {
      const { data: rest } = await supabase
        .from('product_images')
        .select('id')
        .eq('product_id', id)
        .order('sort_order', { ascending: true })
        .limit(1)
      if (rest?.length) {
        await supabase.from('product_images').update({ is_primary: true }).eq('id', rest[0].id)
      }
    }

    // Best-effort Storage cleanup (no-op for a legacy static path).
    const path = productImagePathFromPublicUrl(row.image_url)
    if (path) {
      const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path])
      if (error) console.error('[admin/products/images] storage cleanup failed:', error.message)
    }

    return { ok: true }
  } catch (err) {
    console.error('[admin/products/images] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not remove the image.' }
  }
})
