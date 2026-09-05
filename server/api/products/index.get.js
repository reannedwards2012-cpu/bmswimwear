/**
 * GET /api/products?category=<optional>
 *
 * Public storefront product list (grid + homepage). Active products only.
 * Safe fields only — see server/utils/productMappers.js. Fabrics/colours are
 * NOT here; the storefront still fetches those from
 * /api/products/:productId/fabrics (unchanged).
 */
import { supabaseAdmin } from '../../utils/supabaseAdmin.js'
import { CATEGORIES } from '../../../data/constants.js'
import { PRODUCT_CARD_SELECT, mapProductCard } from '../../utils/productMappers.js'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const category = typeof q.category === 'string' && q.category ? q.category : ''

  if (category && !CATEGORIES.includes(category)) {
    setResponseStatus(event, 400)
    return { error: 'Unknown category.' }
  }

  try {
    const supabase = supabaseAdmin()

    let query = supabase.from('products').select(PRODUCT_CARD_SELECT).eq('is_active', true)
    if (category) query = query.eq('category', category)
    query = query.order('sort_order', { ascending: true, nullsFirst: false }).order('name', { ascending: true })

    const { data, error } = await query

    if (error) {
      console.error('[products] list query failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load products.' }
    }

    return { products: (data ?? []).map(mapProductCard) }
  } catch (err) {
    console.error('[products] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load products.' }
  }
})
