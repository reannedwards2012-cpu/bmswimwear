/**
 * POST /api/admin/orders/image
 *
 * Admin-only. Uploads one reference/design image for a manual order item to
 * the 'order-images' Storage bucket (multipart/form-data, field "file") and
 * returns its public URL. Does NOT touch any table — the caller
 * (pages/admin/orders/new.vue) puts the URL into the manual-order create
 * payload's item.imageUrl. Mirrors server/api/admin/products/image.post.js.
 */
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import {
  ORDER_IMAGE_BUCKET,
  ORDER_IMAGE_TYPES,
  ORDER_IMAGE_MAX_BYTES,
  ORDER_IMAGE_UPLOAD_PREVIEW_TTL_SECONDS,
  orderExtForMime,
  signOrderImageUrl
} from '../../../utils/orderImages.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  let parts
  try {
    parts = await readMultipartFormData(event)
  } catch (err) {
    console.error('[admin/orders/image] multipart parse failed:', err?.message)
    setResponseStatus(event, 400)
    return { error: 'Could not read the uploaded file.' }
  }

  const filePart = (parts || []).find((p) => p.name === 'file' && p.filename)
  if (!filePart || !filePart.data?.length) {
    setResponseStatus(event, 400)
    return { error: 'No file was uploaded.' }
  }

  const type = filePart.type || ''
  if (!ORDER_IMAGE_TYPES.includes(type)) {
    setResponseStatus(event, 400)
    return { error: 'Please upload a JPEG, PNG or WebP image.' }
  }
  if (filePart.data.length > ORDER_IMAGE_MAX_BYTES) {
    setResponseStatus(event, 400)
    return { error: 'Image is too large — please upload one under 5MB.' }
  }

  const path = `${randomUUID()}.${orderExtForMime(type)}`

  try {
    const supabase = supabaseAdmin()
    const { error: uploadError } = await supabase.storage
      .from(ORDER_IMAGE_BUCKET)
      .upload(path, filePart.data, { contentType: type, upsert: false })

    if (uploadError) {
      console.error('[admin/orders/image] upload failed:', uploadError.message)
      setResponseStatus(event, 500)
      return {
        error: /bucket.*not.*found/i.test(uploadError.message || '')
          ? 'The order-images Storage bucket has not been created yet.'
          : 'Could not upload image. Please try again.'
      }
    }

    // getPublicUrl() still returns a URL string even on a private bucket —
    // it's just no longer fetchable without auth. Kept as the canonical
    // STORED value (unchanged shape, so orderImagePathFromPublicUrl() keeps
    // working on both old and new rows); `previewUrl` is a short-lived
    // signed URL for immediately displaying what was just uploaded, before
    // the order itself is saved.
    const { data } = supabase.storage.from(ORDER_IMAGE_BUCKET).getPublicUrl(path)
    const previewUrl = await signOrderImageUrl(supabase, data.publicUrl, ORDER_IMAGE_UPLOAD_PREVIEW_TTL_SECONDS)
    return { url: data.publicUrl, previewUrl: previewUrl || data.publicUrl }
  } catch (err) {
    console.error('[admin/orders/image] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not upload image. Please try again.' }
  }
})
