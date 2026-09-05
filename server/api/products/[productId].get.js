/**
 * GET /api/products/:productId   (productId = the catalogue slug)
 *
 * Public storefront product detail. 404 for a missing OR inactive product —
 * inactive products are never exposed publicly. Embeds up to 3 `related`
 * products (same category, active). Safe fields only.
 *
 * Colours/fabrics are NOT included — the product page fetches those from the
 * unchanged /api/products/:productId/fabrics endpoint.
 */
import { supabaseAdmin } from '../../utils/supabaseAdmin.js'
import {
  PRODUCT_CARD_SELECT,
  PRODUCT_DETAIL_SELECT,
  mapProductCard,
  mapProductDetail
} from '../../utils/productMappers.js'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'productId')
  if (!slug) {
    setResponseStatus(event, 400)
    return { error: 'Missing product.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_DETAIL_SELECT)
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      console.error('[products/:slug] query failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load this product.' }
    }
    if (!data) {
      setResponseStatus(event, 404)
      return { error: 'Product not found.' }
    }

    const { data: rel, error: relError } = await supabase
      .from('products')
      .select(PRODUCT_CARD_SELECT)
      .eq('is_active', true)
      .eq('category', data.category)
      .neq('slug', slug)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })
      .limit(3)

    if (relError) console.error('[products/:slug] related query failed:', relError.message)

    return {
      product: mapProductDetail(data),
      related: (rel ?? []).map(mapProductCard)
    }
  } catch (err) {
    console.error('[products/:slug] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load this product.' }
  }
})
