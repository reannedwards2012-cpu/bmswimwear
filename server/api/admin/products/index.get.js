/**
 * GET /api/admin/products
 *
 * Admin-only. All products (active + inactive), lightest shape for the list
 * table. Full editable detail is a separate GET /api/admin/products/:id.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { ADMIN_PRODUCT_LIST_SELECT, mapAdminProductListItem } from '../../../utils/productMappers.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('products')
      .select(ADMIN_PRODUCT_LIST_SELECT)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })

    if (error) {
      console.error('[admin/products] list query failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load products.' }
    }

    return { products: (data ?? []).map(mapAdminProductListItem) }
  } catch (err) {
    console.error('[admin/products] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load products.' }
  }
})
