/**
 * POST /api/admin/products/image
 *
 * Admin-only. Uploads one image file to the 'product-images' Storage bucket
 * (multipart/form-data, field "file") and returns its public URL. Does NOT
 * touch any table — the caller attaches the URL as a product_images row via
 * POST /api/admin/products/:id/images (or passes it in the create body).
 * Mirrors server/api/admin/fabrics/image.post.js.
 */
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import {
  PRODUCT_IMAGE_BUCKET,
  PRODUCT_IMAGE_TYPES,
  PRODUCT_IMAGE_MAX_BYTES,
  productExtForMime
} from '../../../utils/productImages.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  let parts
  try {
    parts = await readMultipartFormData(event)
  } catch (err) {
    console.error('[admin/products/image] multipart parse failed:', err?.message)
    setResponseStatus(event, 400)
    return { error: 'Could not read the uploaded file.' }
  }

  const filePart = (parts || []).find((p) => p.name === 'file' && p.filename)
  if (!filePart || !filePart.data?.length) {
    setResponseStatus(event, 400)
    return { error: 'No file was uploaded.' }
  }

  const type = filePart.type || ''
  if (!PRODUCT_IMAGE_TYPES.includes(type)) {
    setResponseStatus(event, 400)
    return { error: 'Please upload a JPEG, PNG or WebP image.' }
  }
  if (filePart.data.length > PRODUCT_IMAGE_MAX_BYTES) {
    setResponseStatus(event, 400)
    return { error: 'Image is too large — please upload one under 5MB.' }
  }

  const path = `${randomUUID()}.${productExtForMime(type)}`

  try {
    const supabase = supabaseAdmin()
    const { error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(path, filePart.data, { contentType: type, upsert: false })

    if (uploadError) {
      console.error('[admin/products/image] upload failed:', uploadError.message)
      setResponseStatus(event, 500)
      return {
        error: /bucket.*not.*found/i.test(uploadError.message || '')
          ? 'The product-images Storage bucket has not been created yet.'
          : 'Could not upload image. Please try again.'
      }
    }

    const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path)
    return { url: data.publicUrl }
  } catch (err) {
    console.error('[admin/products/image] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not upload image. Please try again.' }
  }
})
