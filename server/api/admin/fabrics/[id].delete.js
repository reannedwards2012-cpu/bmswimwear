/**
 * DELETE /api/admin/fabrics/:id
 *
 * Admin-only. Permanently deletes a fabric row:
 *   1. Explicitly deletes its product_fabrics compatibility rows FIRST — not
 *      left to an assumed `ON DELETE CASCADE`. That FK isn't defined in any
 *      migration checked into this repo (this schema predates one), so it
 *      isn't something to silently depend on; deleting the join rows
 *      ourselves guarantees no orphaned product_fabrics record can survive
 *      this fabric, regardless of what the live constraint actually is. If
 *      this step fails, the fabric row is left untouched and the request
 *      errors — never a half-cleaned-up state.
 *   2. Deletes the fabric row itself.
 *   3. Best-effort deletes its Storage image, AFTER the row is confirmed
 *      gone (a failed Storage cleanup never undoes the already-successful
 *      database delete — it's logged and swallowed).
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

    // Explicit cleanup of compatibility links — see the header comment on
    // why this isn't left to an assumed cascade. Runs before the fabric row
    // is touched; if it fails, nothing has been deleted yet.
    const { error: linkError } = await supabase.from('product_fabrics').delete().eq('fabric_id', id)
    if (linkError) {
      console.error('[admin/fabrics] product_fabrics cleanup failed:', linkError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not delete fabric.' }
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
