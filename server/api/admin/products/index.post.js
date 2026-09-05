/**
 * POST /api/admin/products
 *
 * Admin-only. Creates a product and its sizes / coverage / details /
 * compatible-fabric relationships (and, optionally, image rows from
 * already-uploaded URLs). All validated server-side.
 *
 * The product_fabrics link is existence-only with is_available:true — the
 * same semantics the Fabric admin's own product-compatibility checklist
 * uses, so editing compatibility from either side behaves identically.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { validateProductFields, validateStringList, validateFabricIds } from '../../../utils/productValidation.js'
import { ADMIN_PRODUCT_DETAIL_SELECT, mapAdminProductDetail } from '../../../utils/productMappers.js'

const str = (v) => (typeof v === 'string' ? v.trim() : '')

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const { issues: fieldIssues, fields } = validateProductFields(body, { partial: false })
  // On create an omitted list means "none", not "leave alone" — coalesce to [].
  const sz = validateStringList(body?.sizes, 'Sizes')
  const cv = validateStringList(body?.coverage, 'Coverage')
  const dt = validateStringList(body?.details, 'Details')
  const sizes = sz.values ?? []
  const coverage = cv.values ?? []
  const details = dt.values ?? []
  const sizeIssues = sz.issues
  const covIssues = cv.issues
  const detIssues = dt.issues

  const rawImages = Array.isArray(body?.images) ? body.images.map(str).filter(Boolean) : []

  try {
    const supabase = supabaseAdmin()
    const { issues: fabricIssues, fabricIds } = await validateFabricIds(body?.fabricIds, supabase)

    const allIssues = [...fieldIssues, ...sizeIssues, ...covIssues, ...detIssues, ...fabricIssues]
    // required-on-create fields the validator only flags when present
    for (const [k, label] of [['name', 'Name'], ['slug', 'Slug'], ['category', 'Category'], ['priceUsdCents', 'USD price'], ['priceXcdCents', 'XCD price']]) {
      if (fields[k] === undefined) allIssues.push(`${label} is required.`)
    }
    if (allIssues.length) {
      setResponseStatus(event, 400)
      return { error: 'Invalid product details.', issues: allIssues }
    }

    const { data: product, error: insertError } = await supabase
      .from('products')
      .insert({
        slug: fields.slug,
        name: fields.name,
        category: fields.category,
        description: fields.description ?? null,
        price_usd_cents: fields.priceUsdCents,
        price_xcd_cents: fields.priceXcdCents,
        is_active: fields.isActive,
        is_featured: fields.isFeatured,
        sort_order: fields.sortOrder ?? null
      })
      .select('id, slug')
      .single()

    if (insertError || !product) {
      if (insertError?.code === '23505') {
        setResponseStatus(event, 409)
        return { error: 'That slug is already in use.' }
      }
      console.error('[admin/products] insert failed:', insertError?.message)
      setResponseStatus(event, 500)
      return { error: 'Could not create product.' }
    }

    const childInserts = []
    if (sizes.length) {
      childInserts.push(
        supabase.from('product_sizes').insert(sizes.map((size, i) => ({ product_id: product.id, size, sort_order: i })))
      )
    }
    if (coverage.length) {
      childInserts.push(
        supabase
          .from('product_coverages')
          .insert(coverage.map((c, i) => ({ product_id: product.id, coverage: c, sort_order: i })))
      )
    }
    if (details.length) {
      childInserts.push(
        supabase
          .from('product_details')
          .insert(details.map((detail, i) => ({ product_id: product.id, detail, sort_order: i })))
      )
    }
    if (rawImages.length) {
      childInserts.push(
        supabase
          .from('product_images')
          .insert(rawImages.map((image_url, i) => ({ product_id: product.id, image_url, sort_order: i, is_primary: i === 0 })))
      )
    }
    if (fabricIds && fabricIds.length) {
      childInserts.push(
        supabase
          .from('product_fabrics')
          .insert(fabricIds.map((fabric_id) => ({ product_id: product.slug, fabric_id, is_available: true })))
      )
    }

    const childResults = await Promise.all(childInserts)
    const childError = childResults.find((r) => r.error)
    if (childError) {
      // Roll the product back so a half-populated product never ships.
      await supabase.from('products').delete().eq('id', product.id)
      console.error('[admin/products] child insert failed — rolled back:', childError.error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not create product.' }
    }

    const { data: full } = await supabase
      .from('products')
      .select(ADMIN_PRODUCT_DETAIL_SELECT)
      .eq('id', product.id)
      .maybeSingle()

    setResponseStatus(event, 201)
    return { product: full ? mapAdminProductDetail(full) : { id: product.id, slug: product.slug } }
  } catch (err) {
    console.error('[admin/products] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not create product.' }
  }
})
