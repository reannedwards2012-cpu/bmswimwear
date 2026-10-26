/**
 * POST /api/admin/quotes/inspiration-image
 *
 * Admin-only. Uploads one image file to the 'quote-inspiration-images'
 * Storage bucket (multipart/form-data, field name "file") and returns its
 * public URL. Does NOT touch the quotes table — the caller appends the
 * returned URL to the quote's own `inspirationImageUrls` array and saves it
 * through the normal create/update endpoints, mirroring the fabric image
 * upload pattern.
 */
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, extForMime } from '../../../utils/fabricImages.js'
import { QUOTE_INSPIRATION_IMAGE_BUCKET } from '../../../utils/quoteInspirationImages.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  let parts
  try {
    parts = await readMultipartFormData(event)
  } catch (err) {
    console.error('[admin/quotes/inspiration-image] multipart parse failed:', err?.message)
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

  const path = `${randomUUID()}.${extForMime(type)}`

  try {
    const supabase = supabaseAdmin()

    const { error: uploadError } = await supabase.storage
      .from(QUOTE_INSPIRATION_IMAGE_BUCKET)
      .upload(path, filePart.data, { contentType: type, upsert: false })

    if (uploadError) {
      console.error('[admin/quotes/inspiration-image] upload failed:', uploadError.message)
      setResponseStatus(event, 500)
      return {
        error: /bucket.*not.*found/i.test(uploadError.message || '')
          ? 'The quote-inspiration-images Storage bucket has not been created yet. See setup steps.'
          : 'Could not upload image. Please try again.'
      }
    }

    const { data } = supabase.storage.from(QUOTE_INSPIRATION_IMAGE_BUCKET).getPublicUrl(path)
    return { url: data.publicUrl }
  } catch (err) {
    console.error('[admin/quotes/inspiration-image] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not upload image. Please try again.' }
  }
})
