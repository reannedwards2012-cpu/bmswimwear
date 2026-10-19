/**
 * POST /api/admin/bikini-mix/video
 *
 * Admin-only. Uploads the promo video (multipart/form-data, field "file")
 * to the 'bikini-mix-media' bucket and returns its public URL. Mirrors
 * server/api/admin/products/image.post.js / stockists/image.post.js, except
 * for video. Does NOT touch bikini_mix_event — the caller PATCHes
 * { promoVideoUrl } separately, same two-step pattern as product images.
 */
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import {
  BIKINI_MIX_MEDIA_BUCKET,
  BIKINI_MIX_VIDEO_TYPES,
  BIKINI_MIX_VIDEO_MAX_BYTES,
  bikiniMixVideoExtForMime
} from '../../../utils/bikiniMixMedia.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  let parts
  try {
    parts = await readMultipartFormData(event)
  } catch (err) {
    console.error('[admin/bikini-mix/video] multipart parse failed:', err?.message)
    setResponseStatus(event, 400)
    return { error: 'Could not read the uploaded file.' }
  }

  const filePart = (parts || []).find((p) => p.name === 'file' && p.filename)
  if (!filePart || !filePart.data?.length) {
    setResponseStatus(event, 400)
    return { error: 'No file was uploaded.' }
  }

  const type = filePart.type || ''
  if (!BIKINI_MIX_VIDEO_TYPES.includes(type)) {
    setResponseStatus(event, 400)
    return { error: 'Please upload an MP4, WebM or MOV video.' }
  }
  if (filePart.data.length > BIKINI_MIX_VIDEO_MAX_BYTES) {
    setResponseStatus(event, 400)
    return { error: 'Video is too large — please upload one under 80MB.' }
  }

  const path = `${randomUUID()}.${bikiniMixVideoExtForMime(type)}`

  try {
    const supabase = supabaseAdmin()
    const { error: uploadError } = await supabase.storage
      .from(BIKINI_MIX_MEDIA_BUCKET)
      .upload(path, filePart.data, { contentType: type, upsert: false })

    if (uploadError) {
      console.error('[admin/bikini-mix/video] upload failed:', uploadError.message)
      setResponseStatus(event, 500)
      return {
        error: /bucket.*not.*found/i.test(uploadError.message || '')
          ? 'The bikini-mix-media Storage bucket has not been created yet.'
          : 'Could not upload video. Please try again.'
      }
    }

    const { data } = supabase.storage.from(BIKINI_MIX_MEDIA_BUCKET).getPublicUrl(path)
    return { url: data.publicUrl }
  } catch (err) {
    console.error('[admin/bikini-mix/video] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not upload video. Please try again.' }
  }
})
