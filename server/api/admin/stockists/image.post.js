/**
 * POST /api/admin/stockists/image
 *
 * Admin-only. Uploads one photo for a manual (non-catalogue) inventory item
 * to the 'stockist-item-images' Storage bucket (multipart/form-data, field
 * "file") and returns its public URL. Mirrors server/api/admin/products/image.post.js.
 * The bucket must be created by hand in the Supabase dashboard first — see
 * the footer of supabase/migrations/20260911120000_stockists.sql.
 */
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import {
  STOCKIST_IMAGE_BUCKET,
  STOCKIST_IMAGE_TYPES,
  STOCKIST_IMAGE_MAX_BYTES,
  stockistImageExtForMime
} from '../../../utils/stockistImages.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  let parts
  try {
    parts = await readMultipartFormData(event)
  } catch (err) {
    console.error('[admin/stockists/image] multipart parse failed:', err?.message)
    setResponseStatus(event, 400)
    return { error: 'Could not read the uploaded file.' }
  }

  const filePart = (parts || []).find((p) => p.name === 'file' && p.filename)
  if (!filePart || !filePart.data?.length) {
    setResponseStatus(event, 400)
    return { error: 'No file was uploaded.' }
  }

  const type = filePart.type || ''
  if (!STOCKIST_IMAGE_TYPES.includes(type)) {
    setResponseStatus(event, 400)
    return { error: 'Please upload a JPEG, PNG or WebP image.' }
  }
  if (filePart.data.length > STOCKIST_IMAGE_MAX_BYTES) {
    setResponseStatus(event, 400)
    return { error: 'Image is too large — please upload one under 5MB.' }
  }

  const path = `${randomUUID()}.${stockistImageExtForMime(type)}`

  try {
    const supabase = supabaseAdmin()
    const { error: uploadError } = await supabase.storage
      .from(STOCKIST_IMAGE_BUCKET)
      .upload(path, filePart.data, { contentType: type, upsert: false })

    if (uploadError) {
      console.error('[admin/stockists/image] upload failed:', uploadError.message)
      setResponseStatus(event, 500)
      return {
        error: /bucket.*not.*found/i.test(uploadError.message || '')
          ? 'The stockist-item-images Storage bucket has not been created yet.'
          : 'Could not upload image. Please try again.'
      }
    }

    const { data } = supabase.storage.from(STOCKIST_IMAGE_BUCKET).getPublicUrl(path)
    return { url: data.publicUrl }
  } catch (err) {
    console.error('[admin/stockists/image] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not upload image. Please try again.' }
  }
})
