/**
 * GET /api/admin/products/:id   (id = products.id UUID)
 *
 * Admin-only. Full editable detail for the product form — scalar fields,
 * sizes/coverage/details, image rows (with ids), and compatible fabric ids.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { ADMIN_PRODUCT_DETAIL_SELECT, mapAdminProductDetail } from '../../../utils/productMappers.js'

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
    const { data, error } = await supabase
      .from('products')
      .select(ADMIN_PRODUCT_DETAIL_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[admin/products] detail query failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load this product.' }
    }
    if (!data) {
      setResponseStatus(event, 404)
      return { error: 'Product not found.' }
    }

    return { product: mapAdminProductDetail(data) }
  } catch (err) {
    console.error('[admin/products] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load this product.' }
  }
})
