/**
 * DELETE /api/admin/fabrics/image
 *
 * Admin-only. Best-effort removal of one object from the 'fabric-images'
 * Storage bucket, given its public URL (body: { url }). Used to clean up a
 * replaced/removed fabric image after a fabric save succeeds — never
 * deletes the fabric row itself. Always resolves { ok: true } — a missing
 * or foreign URL is a no-op, not an error, since this is cleanup, not a
 * user-facing action with its own failure state.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { FABRIC_IMAGE_BUCKET, pathFromPublicUrl } from '../../../utils/fabricImages.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const path = pathFromPublicUrl(body?.url)

  if (path) {
    try {
      const { error } = await supabaseAdmin().storage.from(FABRIC_IMAGE_BUCKET).remove([path])
      if (error) console.error('[admin/fabrics/image] delete failed:', error.message)
    } catch (err) {
      console.error('[admin/fabrics/image] unexpected delete error:', err?.message)
    }
  }

  return { ok: true }
})
