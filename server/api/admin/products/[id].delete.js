/**
 * DELETE /api/admin/products/:id   (id = products.id UUID)
 *
 * Admin-only, permanent. Distinct from soft-delete (isActive: false, still
 * the preferred way to just stop selling something).
 *
 * FK design (Phase C):
 *   - product_sizes / product_coverages / product_details / product_images
 *     → products(id) ON DELETE CASCADE   → removed automatically
 *   - product_fabrics.product_id → products(slug) ON DELETE CASCADE
 *     → this product's fabric links removed automatically
 *   - order_items has NO FK to products (product_id is a text slug SNAPSHOT,
 *     alongside product_name / image / unit_price / size / colour / coverage)
 *     → historical orders are completely untouched.
 *
 * Storage: best-effort removal of this product's own product-images bucket
 * objects. Legacy static /images/products/... paths are never sent to
 * Storage (productImagePathFromPublicUrl returns null for them).
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { PRODUCT_IMAGE_BUCKET, productImagePathFromPublicUrl } from '../../../utils/productImages.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid product id.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: product, error: readErr } = await supabase
      .from('products')
      .select('id, slug, name, product_images(image_url)')
      .eq('id', id)
      .maybeSingle()

    if (readErr) {
      console.error('[admin/products] delete lookup failed:', readErr.message)
      setResponseStatus(event, 500)
      return { error: 'Could not delete this product.' }
    }
    if (!product) {
      setResponseStatus(event, 404)
      return { error: 'Product not found.' }
    }
    // The Go2Pay test product is a standing project fixture until launch —
    // it must not be removed through this endpoint. Deactivate it instead.
    if (product.slug === 'test-product') {
      setResponseStatus(event, 400)
      return { error: 'The Test Product can’t be deleted here. Deactivate it, or remove it at launch.' }
    }

    // Capture Storage paths BEFORE the row (and its product_images) is gone.
    const storagePaths = (product.product_images ?? [])
      .map((i) => productImagePathFromPublicUrl(i.image_url))
      .filter(Boolean)

    const { error: delErr } = await supabase.from('products').delete().eq('id', id)
    if (delErr) {
      console.error('[admin/products] delete failed:', delErr.message)
      setResponseStatus(event, 500)
      return { error: 'Could not delete this product.' }
    }

    // Best-effort — never fail the request over Storage cleanup.
    if (storagePaths.length) {
      const { error: storageErr } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove(storagePaths)
      if (storageErr) console.error('[admin/products] storage cleanup failed:', storageErr.message)
    }

    return { ok: true, name: product.name }
  } catch (err) {
    console.error('[admin/products] unexpected delete error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not delete this product.' }
  }
})
