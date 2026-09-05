/**
 * PATCH /api/admin/products/:id   (id = products.id UUID)
 *
 * Admin-only. Updates scalar fields and, when present in the body, replaces
 * the sizes / coverage / details lists and syncs compatible-fabric
 * relationships (add/remove diff — same as the Fabric admin's own PATCH).
 *
 * Does NOT touch images — those are managed via
 * /api/admin/products/:id/images*. Soft-delete only: set { isActive: false }
 * to remove a product from the storefront without ever breaking a
 * historical order_items snapshot. There is deliberately no hard delete.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { validateProductFields, validateStringList, validateFabricIds } from '../../../utils/productValidation.js'
import { ADMIN_PRODUCT_DETAIL_SELECT, mapAdminProductDetail } from '../../../utils/productMappers.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const FIELD_MAP = {
  name: 'name',
  slug: 'slug',
  category: 'category',
  description: 'description',
  priceUsdCents: 'price_usd_cents',
  priceXcdCents: 'price_xcd_cents',
  isActive: 'is_active',
  isFeatured: 'is_featured',
  sortOrder: 'sort_order'
}

async function replaceList(supabase, table, column, productUuid, values) {
  const del = await supabase.from(table).delete().eq('product_id', productUuid)
  if (del.error) return del.error
  if (values.length) {
    const ins = await supabase
      .from(table)
      .insert(values.map((v, i) => ({ product_id: productUuid, [column]: v, sort_order: i })))
    if (ins.error) return ins.error
  }
  return null
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid product id.' }
  }

  const body = await readBody(event).catch(() => null)
  const { issues: fieldIssues, fields } = validateProductFields(body, { partial: true })
  const { issues: sizeIssues, values: sizes } = validateStringList(body?.sizes, 'Sizes')
  const { issues: covIssues, values: coverage } = validateStringList(body?.coverage, 'Coverage')
  const { issues: detIssues, values: details } = validateStringList(body?.details, 'Details')

  const updates = {}
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) updates[column] = fields[key]
  }

  try {
    const supabase = supabaseAdmin()
    const { issues: fabricIssues, fabricIds } = await validateFabricIds(body?.fabricIds, supabase)

    const allIssues = [...fieldIssues, ...sizeIssues, ...covIssues, ...detIssues, ...fabricIssues]
    if (allIssues.length) {
      setResponseStatus(event, 400)
      return { error: 'Invalid product details.', issues: allIssues }
    }

    // ── scalar fields (slug change cascades to product_fabrics.product_id via the FK) ──
    if (Object.keys(updates).length) {
      const { data: updated, error: updateError } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select('id')
      if (updateError) {
        if (updateError.code === '23505') {
          setResponseStatus(event, 409)
          return { error: 'That slug is already in use.' }
        }
        console.error('[admin/products] update failed:', updateError.message)
        setResponseStatus(event, 500)
        return { error: 'Could not update product.' }
      }
      if (!updated?.length) {
        setResponseStatus(event, 404)
        return { error: 'Product not found.' }
      }
    }

    // Need the current row (id existence + current slug for the fabric diff).
    const { data: current, error: curErr } = await supabase
      .from('products')
      .select('id, slug')
      .eq('id', id)
      .maybeSingle()
    if (curErr || !current) {
      setResponseStatus(event, curErr ? 500 : 404)
      return { error: curErr ? 'Could not update product.' : 'Product not found.' }
    }

    // ── list relations: full replace when the key was sent ──
    if (body && Object.prototype.hasOwnProperty.call(body, 'sizes')) {
      const e = await replaceList(supabase, 'product_sizes', 'size', current.id, sizes)
      if (e) throw new Error(`sizes: ${e.message}`)
    }
    if (body && Object.prototype.hasOwnProperty.call(body, 'coverage')) {
      const e = await replaceList(supabase, 'product_coverages', 'coverage', current.id, coverage)
      if (e) throw new Error(`coverage: ${e.message}`)
    }
    if (body && Object.prototype.hasOwnProperty.call(body, 'details')) {
      const e = await replaceList(supabase, 'product_details', 'detail', current.id, details)
      if (e) throw new Error(`details: ${e.message}`)
    }

    // ── fabric compatibility: add/remove diff against the current slug ──
    if (fabricIds !== undefined) {
      const { data: existing, error: exErr } = await supabase
        .from('product_fabrics')
        .select('fabric_id')
        .eq('product_id', current.slug)
      if (exErr) throw new Error(`fabric read: ${exErr.message}`)

      const have = new Set((existing ?? []).map((r) => r.fabric_id))
      const want = new Set(fabricIds)
      const toAdd = fabricIds.filter((fid) => !have.has(fid))
      const toRemove = [...have].filter((fid) => !want.has(fid))

      if (toAdd.length) {
        const { error } = await supabase.from('product_fabrics').upsert(
          toAdd.map((fabric_id) => ({ product_id: current.slug, fabric_id, is_available: true })),
          { onConflict: 'product_id,fabric_id', ignoreDuplicates: true }
        )
        if (error) throw new Error(`fabric add: ${error.message}`)
      }
      if (toRemove.length) {
        const { error } = await supabase
          .from('product_fabrics')
          .delete()
          .eq('product_id', current.slug)
          .in('fabric_id', toRemove)
        if (error) throw new Error(`fabric remove: ${error.message}`)
      }
    }

    const { data: full, error: readErr } = await supabase
      .from('products')
      .select(ADMIN_PRODUCT_DETAIL_SELECT)
      .eq('id', id)
      .maybeSingle()
    if (readErr || !full) {
      console.error('[admin/products] post-update read failed:', readErr?.message ?? 'not found')
      setResponseStatus(event, 500)
      return { error: 'Product was updated, but could not be re-read.' }
    }

    return { product: mapAdminProductDetail(full) }
  } catch (err) {
    console.error('[admin/products] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update product.' }
  }
})
