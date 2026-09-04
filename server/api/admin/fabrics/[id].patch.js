/**
 * PATCH /api/admin/fabrics/:id
 *
 * Admin-only. Updates a fabric's editable fields and, when `productIds` is
 * present in the body, synchronizes its product_fabrics relationships (adds
 * newly selected products, removes deselected ones). Never deletes the
 * fabric row itself — deactivate via `isActive: false` instead.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { validateFabricFields, validateProductIds } from '../../../utils/fabricValidation.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const FIELD_MAP = {
  name: 'name',
  slug: 'slug',
  type: 'type',
  status: 'status',
  isActive: 'is_active',
  unit: 'unit',
  quantity: 'quantity',
  hexColor: 'hex_color',
  imageUrl: 'image_url'
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid fabric id.' }
  }

  const body = await readBody(event).catch(() => null)
  const { issues, fields } = validateFabricFields(body, { partial: true })
  const { issues: idIssues, productIds } = validateProductIds(body?.productIds)
  const allIssues = [...issues, ...idIssues]

  if (allIssues.length) {
    setResponseStatus(event, 400)
    return { error: 'Invalid fabric details.', issues: allIssues }
  }

  const updates = {}
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) updates[column] = fields[key]
  }

  try {
    const supabase = supabaseAdmin()

    if (Object.keys(updates).length) {
      const { error: updateError, data: updated } = await supabase
        .from('fabrics')
        .update(updates)
        .eq('id', id)
        .select('id')

      if (updateError) {
        if (updateError.code === '23505') {
          setResponseStatus(event, 409)
          return { error: 'That slug is already in use.' }
        }
        console.error('[admin/fabrics] update failed:', updateError.message)
        setResponseStatus(event, 500)
        return { error: 'Could not update fabric.' }
      }
      if (!updated?.length) {
        setResponseStatus(event, 404)
        return { error: 'Fabric not found.' }
      }
    }

    // ── synchronize product relationships (only when productIds was sent) ──
    if (productIds !== undefined) {
      const { data: current, error: currentError } = await supabase
        .from('product_fabrics')
        .select('product_id')
        .eq('fabric_id', id)

      if (currentError) {
        console.error('[admin/fabrics] relationship read failed:', currentError.message)
        setResponseStatus(event, 500)
        return { error: 'Fabric details were saved, but product compatibility could not be read back.' }
      }

      const currentIds = new Set((current ?? []).map((r) => r.product_id))
      const nextIds = new Set(productIds)
      const toAdd = productIds.filter((pid) => !currentIds.has(pid))
      const toRemove = [...currentIds].filter((pid) => !nextIds.has(pid))

      if (toAdd.length) {
        const { error: addError } = await supabase.from('product_fabrics').upsert(
          toAdd.map((product_id) => ({ product_id, fabric_id: id, is_available: true })),
          { onConflict: 'product_id,fabric_id', ignoreDuplicates: true }
        )
        if (addError) {
          console.error('[admin/fabrics] relationship add failed:', addError.message)
          setResponseStatus(event, 500)
          return { error: 'Fabric details were saved, but some product links could not be added.' }
        }
      }

      if (toRemove.length) {
        const { error: removeError } = await supabase
          .from('product_fabrics')
          .delete()
          .eq('fabric_id', id)
          .in('product_id', toRemove)
        if (removeError) {
          console.error('[admin/fabrics] relationship remove failed:', removeError.message)
          setResponseStatus(event, 500)
          return { error: 'Fabric details were saved, but some product links could not be removed.' }
        }
      }
    }

    const { data: fabric, error: readError } = await supabase
      .from('fabrics')
      .select(
        'id, name, slug, type, hex_color, image_url, quantity, unit, status, is_active, product_fabrics(product_id)'
      )
      .eq('id', id)
      .maybeSingle()

    if (readError || !fabric) {
      console.error('[admin/fabrics] post-update read failed:', readError?.message ?? 'not found')
      setResponseStatus(event, 500)
      return { error: 'Fabric was updated, but could not be re-read.' }
    }

    return {
      fabric: {
        id: fabric.id,
        name: fabric.name,
        slug: fabric.slug,
        type: fabric.type,
        hexColor: fabric.hex_color,
        imageUrl: fabric.image_url,
        quantity: fabric.quantity,
        unit: fabric.unit,
        status: fabric.status,
        isActive: fabric.is_active,
        productIds: (fabric.product_fabrics ?? []).map((pf) => pf.product_id)
      }
    }
  } catch (err) {
    console.error('[admin/fabrics] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update fabric.' }
  }
})
