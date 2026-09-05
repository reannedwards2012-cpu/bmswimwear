/**
 * POST /api/admin/products/:id/images   (id = products.id UUID)
 *
 * Admin-only. Attaches an already-uploaded image URL as a product_images
 * row: appended at the end (sort_order = current max + 1), marked primary
 * only if it's the product's first image.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_URL = 500

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid product id.' }
  }

  const body = await readBody(event).catch(() => null)
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!url || url.length > MAX_URL) {
    setResponseStatus(event, 400)
    return { error: 'A valid image URL is required.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: product, error: prodErr } = await supabase.from('products').select('id').eq('id', id).maybeSingle()
    if (prodErr) {
      console.error('[admin/products/images] product lookup failed:', prodErr.message)
      setResponseStatus(event, 500)
      return { error: 'Could not add the image.' }
    }
    if (!product) {
      setResponseStatus(event, 404)
      return { error: 'Product not found.' }
    }

    const { data: existing, error: exErr } = await supabase
      .from('product_images')
      .select('sort_order')
      .eq('product_id', id)
    if (exErr) {
      console.error('[admin/products/images] existing read failed:', exErr.message)
      setResponseStatus(event, 500)
      return { error: 'Could not add the image.' }
    }

    const nextSort = (existing ?? []).reduce((max, r) => Math.max(max, r.sort_order ?? 0), -1) + 1
    const isPrimary = (existing ?? []).length === 0

    const { data: row, error: insErr } = await supabase
      .from('product_images')
      .insert({ product_id: id, image_url: url, sort_order: nextSort, is_primary: isPrimary })
      .select('id, image_url, sort_order, is_primary')
      .single()

    if (insErr || !row) {
      console.error('[admin/products/images] insert failed:', insErr?.message)
      setResponseStatus(event, 500)
      return { error: 'Could not add the image.' }
    }

    setResponseStatus(event, 201)
    return { image: { id: row.id, imageUrl: row.image_url, sortOrder: row.sort_order, isPrimary: row.is_primary } }
  } catch (err) {
    console.error('[admin/products/images] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not add the image.' }
  }
})
