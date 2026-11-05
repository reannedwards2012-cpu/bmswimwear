/**
 * GET /api/admin/bikini-mix/gallery
 *
 * Admin-only. Every gallery image (active or not), for the admin
 * management table.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { GALLERY_IMAGE_SELECT, mapGalleryImage } from '../../../../utils/bikiniMixMappers.js'
import { isMigrationNotAppliedError } from '../../../../utils/bikiniMixMigrationGuard.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('bikini_mix_gallery_images')
      .select(GALLERY_IMAGE_SELECT)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) {
      if (isMigrationNotAppliedError(error)) {
        setResponseStatus(event, 503)
        return { configured: false, error: 'Swimsuit Mixer migration not applied yet.' }
      }
      console.error('[admin/bikini-mix/gallery] query failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load gallery images.' }
    }

    return { images: (data ?? []).map(mapGalleryImage) }
  } catch (err) {
    console.error('[admin/bikini-mix/gallery] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load gallery images.' }
  }
})
