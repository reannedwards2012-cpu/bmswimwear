/**
 * POST /api/admin/bikini-mix/gallery/bulk-delete     body: { ids: string[] }
 *
 * Admin-only. Bulk version of DELETE .../gallery/:id. Each gallery row owns
 * exactly one Storage object — nothing else in the schema references
 * `bikini_mix_gallery_images` — so there's no cross-table safety check
 * needed here (unlike fabrics/products). Rows are deleted first; a failed
 * Storage cleanup for a given image never undoes its already-deleted row
 * (an orphaned file is a harmless cost — a dangling DB row pointing at
 * nothing would be worse), same posture as the single-image endpoint.
 *
 * Capped at MAX_BULK_IDS per call. Every id must be a well-formed UUID.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { isMigrationNotAppliedError } from '../../../../utils/bikiniMixMigrationGuard.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BUCKET = 'bikini-mix-media'
const PUBLIC_URL_MARKER = `/storage/v1/object/public/${BUCKET}/`
export const MAX_BULK_IDS = 100

function pathFromPublicUrl(url) {
  if (typeof url !== 'string') return null
  const idx = url.indexOf(PUBLIC_URL_MARKER)
  if (idx === -1) return null
  return url.slice(idx + PUBLIC_URL_MARKER.length).split(/[?#]/)[0] || null
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const rawIds = Array.isArray(body?.ids) ? body.ids : null

  if (!rawIds || rawIds.length === 0) {
    setResponseStatus(event, 400)
    return { error: 'Provide at least one image id to delete.' }
  }
  if (rawIds.length > MAX_BULK_IDS) {
    setResponseStatus(event, 400)
    return { error: `You can delete at most ${MAX_BULK_IDS} images at a time.` }
  }
  const ids = [...new Set(rawIds)]
  if (ids.some((id) => typeof id !== 'string' || !UUID_RE.test(id))) {
    setResponseStatus(event, 400)
    return { error: 'One or more gallery image ids are invalid.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: deleted, error: deleteError } = await supabase
      .from('bikini_mix_gallery_images')
      .delete()
      .in('id', ids)
      .select('id, image_url')

    if (deleteError) {
      if (isMigrationNotAppliedError(deleteError)) {
        setResponseStatus(event, 503)
        return { configured: false, error: 'Swimsuit Mixer migration not applied yet.' }
      }
      console.error('[admin/bikini-mix/gallery] bulk-delete failed:', deleteError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not delete the selected images.' }
    }

    const rows = deleted ?? []
    const storagePaths = rows.map((r) => pathFromPublicUrl(r.image_url)).filter(Boolean)
    if (storagePaths.length) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove(storagePaths)
      if (storageError) console.error('[admin/bikini-mix/gallery] bulk-delete storage cleanup failed:', storageError.message)
    }

    return { ok: true, deletedCount: rows.length, requestedCount: ids.length }
  } catch (err) {
    console.error('[admin/bikini-mix/gallery] unexpected bulk-delete error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not delete the selected images.' }
  }
})
