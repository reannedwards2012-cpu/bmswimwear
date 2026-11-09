/**
 * POST /api/admin/bikini-mix/video-thumbnail-image
 *
 * Admin-only. Uploads one image (multipart/form-data, field "file") to the
 * 'bikini-mix-media' bucket under a 'thumbnails/' prefix and returns its
 * public URL. Mirrors server/api/admin/fabrics/image.post.js exactly — does
 * NOT touch bikini_mix_event itself; the caller (pages/admin/bikini-mix/
 * index.vue) puts the returned URL into the normal event PATCH payload's
 * promoVideoThumbnailUrl field, reusing the existing validated endpoint.
 *
 * A plain server-side upload, not the signed-URL direct-to-Storage flow the
 * video itself needs — a poster image is capped at 5MB, safely under
 * Netlify's synchronous-function payload ceiling, so there's no hang risk
 * here (same reasoning as the gallery image endpoint).
 */
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { BIKINI_MIX_MEDIA_BUCKET } from '../../../utils/bikiniMixMedia.js'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  let parts
  try {
    parts = await readMultipartFormData(event)
  } catch (err) {
    console.error('[admin/bikini-mix/video-thumbnail-image] multipart parse failed:', err?.message)
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

  const path = `thumbnails/${randomUUID()}.${EXT_BY_MIME[type] || 'bin'}`

  try {
    const supabase = supabaseAdmin()

    const { error: uploadError } = await supabase.storage
      .from(BIKINI_MIX_MEDIA_BUCKET)
      .upload(path, filePart.data, { contentType: type, upsert: false })

    if (uploadError) {
      console.error('[admin/bikini-mix/video-thumbnail-image] upload failed:', uploadError.message)
      setResponseStatus(event, 500)
      return {
        error: /bucket.*not.*found/i.test(uploadError.message || '')
          ? 'The bikini-mix-media Storage bucket has not been created yet.'
          : 'Could not upload image. Please try again.'
      }
    }

    const { data } = supabase.storage.from(BIKINI_MIX_MEDIA_BUCKET).getPublicUrl(path)
    return { url: data.publicUrl }
  } catch (err) {
    console.error('[admin/bikini-mix/video-thumbnail-image] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not upload image. Please try again.' }
  }
})
