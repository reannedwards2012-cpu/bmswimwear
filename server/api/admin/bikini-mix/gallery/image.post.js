/**
 * POST /api/admin/bikini-mix/gallery/image
 *
 * Admin-only. Uploads one image (multipart/form-data, field "file") to the
 * 'bikini-mix-media' bucket under a 'gallery/' prefix, AND creates the
 * bikini_mix_gallery_images row in one step — unlike the fabric-image
 * pattern (which only uploads and lets the caller fold the URL into a
 * separate create/update call), the gallery has no other "create" step to
 * fold into, so this endpoint does both atomically enough for admin use
 * (upload, then insert; if the insert fails the orphaned Storage object is
 * harmless and can be cleaned up by hand, same risk profile as every other
 * image-upload endpoint in this codebase).
 */
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { validateGalleryImageFields } from '../../../../utils/bikiniMixValidation.js'
import { GALLERY_IMAGE_SELECT, mapGalleryImage } from '../../../../utils/bikiniMixMappers.js'
import { isMigrationNotAppliedError } from '../../../../utils/bikiniMixMigrationGuard.js'

const BUCKET = 'bikini-mix-media'
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  let parts
  try {
    parts = await readMultipartFormData(event)
  } catch (err) {
    console.error('[admin/bikini-mix/gallery] multipart parse failed:', err?.message)
    setResponseStatus(event, 400)
    return { error: 'Could not read the uploaded file.' }
  }

  const filePart = (parts || []).find((p) => p.name === 'file' && p.filename)
  if (!filePart || !filePart.data?.length) {
    setResponseStatus(event, 400)
    return { error: 'No file was uploaded.' }
  }
  const type = filePart.type || ''
  if (!ALLOWED_IMAGE_TYPES.includes(type)) {
    setResponseStatus(event, 400)
    return { error: 'Please upload a JPEG, PNG or WebP image.' }
  }
  if (filePart.data.length > MAX_IMAGE_BYTES) {
    setResponseStatus(event, 400)
    return { error: 'Image is too large — please upload one under 5MB.' }
  }

  // Remaining (non-file) fields travel alongside the file in the same
  // multipart body.
  const fieldsRaw = {}
  for (const p of parts) {
    if (p.name && p.name !== 'file' && !p.filename) fieldsRaw[p.name] = p.data.toString('utf8')
  }
  if (fieldsRaw.includedInTicket != null) fieldsRaw.includedInTicket = fieldsRaw.includedInTicket === 'true'
  if (fieldsRaw.sortOrder === '') delete fieldsRaw.sortOrder

  const { issues, fields } = validateGalleryImageFields(fieldsRaw, { partial: false })
  if (issues.length) {
    setResponseStatus(event, 400)
    return { error: 'Invalid gallery image details.', issues }
  }

  const path = `gallery/${randomUUID()}.${EXT_BY_MIME[type] || 'bin'}`

  try {
    const supabase = supabaseAdmin()

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, filePart.data, { contentType: type, upsert: false })
    if (uploadError) {
      console.error('[admin/bikini-mix/gallery] upload failed:', uploadError.message)
      setResponseStatus(event, 500)
      return {
        error: /bucket.*not.*found/i.test(uploadError.message || '')
          ? 'The bikini-mix-media Storage bucket has not been created yet. See setup steps.'
          : 'Could not upload image. Please try again.'
      }
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path)

    const { data: row, error: insertError } = await supabase
      .from('bikini_mix_gallery_images')
      .insert({
        image_url: publicUrlData.publicUrl,
        caption: fields.caption,
        category: fields.category,
        included_in_ticket: fields.includedInTicket,
        is_active: fields.isActive,
        sort_order: fields.sortOrder
      })
      .select(GALLERY_IMAGE_SELECT)
      .single()

    if (insertError || !row) {
      if (isMigrationNotAppliedError(insertError)) {
        setResponseStatus(event, 503)
        return { configured: false, error: 'Swimsuit Mixer migration not applied yet — the image was uploaded but cannot be saved.' }
      }
      console.error('[admin/bikini-mix/gallery] insert failed:', insertError?.message)
      setResponseStatus(event, 500)
      return { error: 'Image uploaded, but could not be saved. Please try again.' }
    }

    setResponseStatus(event, 201)
    return { image: mapGalleryImage(row) }
  } catch (err) {
    console.error('[admin/bikini-mix/gallery] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not upload image. Please try again.' }
  }
})
