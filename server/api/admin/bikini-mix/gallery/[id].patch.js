/**
 * PATCH /api/admin/bikini-mix/gallery/:id
 *
 * Admin-only. Updates a gallery image's metadata (caption, category,
 * included-in-ticket flag, active/visible, sort order). Never re-uploads
 * the image itself — use the image.post.js endpoint + delete the old row
 * to replace a photo.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { validateGalleryImageFields } from '../../../../utils/bikiniMixValidation.js'
import { GALLERY_IMAGE_SELECT, mapGalleryImage } from '../../../../utils/bikiniMixMappers.js'
import { isMigrationNotAppliedError } from '../../../../utils/bikiniMixMigrationGuard.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const COLUMN_BY_FIELD = {
  caption: 'caption',
  category: 'category',
  includedInTicket: 'included_in_ticket',
  isActive: 'is_active',
  sortOrder: 'sort_order'
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid gallery image id.' }
  }

  const body = await readBody(event).catch(() => null)
  const { issues, fields } = validateGalleryImageFields(body, { partial: true })
  if (issues.length) {
    setResponseStatus(event, 400)
    return { error: 'Invalid gallery image details.', issues }
  }

  const patch = {}
  for (const [key, column] of Object.entries(COLUMN_BY_FIELD)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) patch[column] = fields[key]
  }
  if (!Object.keys(patch).length) {
    setResponseStatus(event, 400)
    return { error: 'No changes were provided.' }
  }

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('bikini_mix_gallery_images')
      .update(patch)
      .eq('id', id)
      .select(GALLERY_IMAGE_SELECT)
      .maybeSingle()

    if (error) {
      if (isMigrationNotAppliedError(error)) {
        setResponseStatus(event, 503)
        return { configured: false, error: 'Swimsuit Mixer migration not applied yet — changes cannot be saved.' }
      }
      console.error('[admin/bikini-mix/gallery] update failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update image.' }
    }
    if (!data) {
      setResponseStatus(event, 404)
      return { error: 'Gallery image not found.' }
    }

    return { image: mapGalleryImage(data) }
  } catch (err) {
    console.error('[admin/bikini-mix/gallery] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update image.' }
  }
})
