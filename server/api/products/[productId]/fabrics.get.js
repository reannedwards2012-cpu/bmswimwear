/**
 * GET /api/products/:productId/fabrics
 *
 * Storefront-facing fabric availability for one catalogue product (the
 * `product_id` string from data/products.js — no products table exists in
 * Supabase). Returns only fabrics that are:
 *   - linked to this product (product_fabrics.product_id = :productId)
 *   - offered on this product (product_fabrics.is_available = true)
 *   - active in the shared registry (fabrics.is_active = true)
 *
 * An 'unavailable' fabric.status IS still returned (so the storefront can
 * show it disabled) — only product_fabrics.is_available=false and
 * fabrics.is_active=false remove a row entirely. Fields are a strict safe
 * whitelist: no Supabase UUIDs, quantity, unit, or timestamps.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'

export default defineEventHandler(async (event) => {
  const productId = getRouterParam(event, 'productId')

  if (!productId) {
    setResponseStatus(event, 400)
    return { error: 'Missing product id' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data, error } = await supabase
      .from('fabrics')
      .select('slug, name, hex_color, type, status, image_url, product_fabrics!inner(product_id, is_available)')
      .eq('is_active', true)
      .eq('product_fabrics.product_id', productId)
      .eq('product_fabrics.is_available', true)
      .order('name', { ascending: true })

    if (error) {
      console.error('[products/fabrics] query failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load fabric options' }
    }

    const fabrics = (data ?? []).map((row) => ({
      id: row.slug,
      name: row.name,
      hex: row.hex_color,
      type: row.type,
      status: row.status,
      imageUrl: row.image_url
    }))

    // A successful response — including an empty array for a product with no
    // linked fabrics yet — is authoritative. The caller must not treat this
    // as a failure or substitute the hardcoded catalogue colours for it.
    return { fabrics }
  } catch (err) {
    console.error('[products/fabrics] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load fabric options' }
  }
})
