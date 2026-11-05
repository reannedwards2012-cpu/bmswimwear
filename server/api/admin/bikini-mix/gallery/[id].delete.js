/**
 * DELETE /api/admin/bikini-mix/gallery/:id
 *
 * Admin-only. Removes a gallery image row and its Storage object. The row
 * is looked up first so the Storage path can be derived from its
 * image_url; if cleanup of the Storage object fails, the row is still
 * deleted (an orphaned file is a harmless, cheap cost — a dangling DB row
 * pointing at nothing would be worse, since it'd show a broken image to
 * customers).
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { isMigrationNotAppliedError } from '../../../../utils/bikiniMixMigrationGuard.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BUCKET = 'bikini-mix-media'
const PUBLIC_URL_MARKER = `/storage/v1/object/public/${BUCKET}/`

function pathFromPublicUrl(url) {
  if (typeof url !== 'string') return null
  const idx = url.indexOf(PUBLIC_URL_MARKER)
  if (idx === -1) return null
  return url.slice(idx + PUBLIC_URL_MARKER.length).split(/[?#]/)[0] || null
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid gallery image id.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: row, error: readError } = await supabase.from('bikini_mix_gallery_images').select('image_url').eq('id', id).maybeSingle()
    if (readError) {
      if (isMigrationNotAppliedError(readError)) {
        setResponseStatus(event, 503)
        return { configured: false, error: 'Swimsuit Mixer migration not applied yet.' }
      }
      console.error('[admin/bikini-mix/gallery] lookup failed:', readError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not delete image.' }
    }
    if (!row) {
      setResponseStatus(event, 404)
      return { error: 'Gallery image not found.' }
    }

    const { error: deleteError } = await supabase.from('bikini_mix_gallery_images').delete().eq('id', id)
    if (deleteError) {
      console.error('[admin/bikini-mix/gallery] delete failed:', deleteError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not delete image.' }
    }

    const storagePath = pathFromPublicUrl(row.image_url)
    if (storagePath) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath])
      if (storageError) console.error('[admin/bikini-mix/gallery] storage cleanup failed:', storageError.message)
    }

    return { ok: true, id }
  } catch (err) {
    console.error('[admin/bikini-mix/gallery] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not delete image.' }
  }
})
