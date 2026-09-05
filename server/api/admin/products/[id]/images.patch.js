/**
 * PATCH /api/admin/products/:id/images   (id = products.id UUID)
 *
 * Admin-only. Bulk image housekeeping in one call:
 *   { order: [imageId, ...] }   → rewrites sort_order to match the array
 *   { primaryId: imageId }      → makes that one primary, unsets the rest
 * Either or both. Ids not belonging to this product are ignored.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid product id.' }
  }

  const body = await readBody(event).catch(() => null)
  const order = Array.isArray(body?.order) ? body.order.filter((v) => typeof v === 'string' && UUID_RE.test(v)) : null
  const primaryId = typeof body?.primaryId === 'string' && UUID_RE.test(body.primaryId) ? body.primaryId : null

  if (!order && !primaryId) {
    setResponseStatus(event, 400)
    return { error: 'Nothing to update — send `order` and/or `primaryId`.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: rows, error: readErr } = await supabase
      .from('product_images')
      .select('id')
      .eq('product_id', id)
    if (readErr) {
      console.error('[admin/products/images] read failed:', readErr.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update images.' }
    }
    const owned = new Set((rows ?? []).map((r) => r.id))

    if (order) {
      const valid = order.filter((imgId) => owned.has(imgId))
      for (let i = 0; i < valid.length; i++) {
        const { error } = await supabase.from('product_images').update({ sort_order: i }).eq('id', valid[i]).eq('product_id', id)
        if (error) throw new Error(`reorder: ${error.message}`)
      }
    }

    if (primaryId && owned.has(primaryId)) {
      // Clear then set — the partial unique index forbids two primaries at once.
      const clear = await supabase.from('product_images').update({ is_primary: false }).eq('product_id', id).neq('id', primaryId)
      if (clear.error) throw new Error(`clear primary: ${clear.error.message}`)
      const set = await supabase.from('product_images').update({ is_primary: true }).eq('id', primaryId).eq('product_id', id)
      if (set.error) throw new Error(`set primary: ${set.error.message}`)
    }

    const { data: after } = await supabase
      .from('product_images')
      .select('id, image_url, sort_order, is_primary')
      .eq('product_id', id)
      .order('sort_order', { ascending: true })

    return {
      images: (after ?? []).map((r) => ({ id: r.id, imageUrl: r.image_url, sortOrder: r.sort_order, isPrimary: r.is_primary }))
    }
  } catch (err) {
    console.error('[admin/products/images] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update images.' }
  }
})
