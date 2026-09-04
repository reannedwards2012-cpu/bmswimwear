/**
 * GET /api/admin/fabrics
 *
 * Admin-only. Returns every fabric — active or not, whatever its status —
 * with the Supabase UUID (fine here; this endpoint is never reached by the
 * storefront) and its linked catalogue product ids.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  try {
    const supabase = supabaseAdmin()

    const { data, error } = await supabase
      .from('fabrics')
      .select(
        'id, name, slug, type, hex_color, image_url, quantity, unit, status, is_active, product_fabrics(product_id)'
      )
      .order('name', { ascending: true })

    if (error) {
      console.error('[admin/fabrics] list query failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load fabrics.' }
    }

    const fabrics = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      hexColor: row.hex_color,
      imageUrl: row.image_url,
      quantity: row.quantity,
      unit: row.unit,
      status: row.status,
      isActive: row.is_active,
      productIds: (row.product_fabrics ?? []).map((pf) => pf.product_id)
    }))

    return { fabrics }
  } catch (err) {
    console.error('[admin/fabrics] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load fabrics.' }
  }
})
