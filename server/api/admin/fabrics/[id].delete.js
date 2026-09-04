/**
 * DELETE /api/admin/fabrics/:id
 *
 * Admin-only. Permanently deletes a fabric row. Its product_fabrics rows are
 * removed automatically via the existing `fabric_id ... on delete cascade`
 * foreign key — never touched manually here. If the fabric had a Storage
 * image, best-effort clean it up too (never lets a failed Storage cleanup
 * undo the already-successful database delete).
 *
 * Distinct from isActive: isActive temporarily hides a fabric from the
 * storefront; this permanently removes the row. 404 for an unknown fabric.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { FABRIC_IMAGE_BUCKET, pathFromPublicUrl } from '../../../utils/fabricImages.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid fabric id.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: fabric, error: findError } = await supabase
      .from('fabrics')
      .select('id, image_url')
      .eq('id', id)
      .maybeSingle()

    if (findError) {
      console.error('[admin/fabrics] delete lookup failed:', findError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not delete fabric.' }
    }
    if (!fabric) {
      setResponseStatus(event, 404)
      return { error: 'Fabric not found.' }
    }

    const { error: deleteError } = await supabase.from('fabrics').delete().eq('id', id)
    if (deleteError) {
      console.error('[admin/fabrics] delete failed:', deleteError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not delete fabric.' }
    }

    // Best-effort Storage cleanup, after the row is confirmed gone.
    // pathFromPublicUrl() only ever recognizes our own fabric-images public
    // URL shape — a browser-supplied value is never used as a raw path.
    const path = pathFromPublicUrl(fabric.image_url)
    if (path) {
      try {
        const { error: storageError } = await supabase.storage.from(FABRIC_IMAGE_BUCKET).remove([path])
        if (storageError) console.error('[admin/fabrics] image cleanup after delete failed:', storageError.message)
      } catch (err) {
        console.error('[admin/fabrics] image cleanup after delete failed:', err?.message)
      }
    }

    return { ok: true, id }
  } catch (err) {
    console.error('[admin/fabrics] unexpected delete error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not delete fabric.' }
  }
})
