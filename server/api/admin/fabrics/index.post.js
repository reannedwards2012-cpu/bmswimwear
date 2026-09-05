/**
 * POST /api/admin/fabrics
 *
 * Admin-only. Creates a fabric, then (if productIds were sent) its
 * product_fabrics relationships. All fields are validated server-side —
 * the browser never writes to Supabase directly.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { validateFabricFields, validateProductIds } from '../../../utils/fabricValidation.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const { issues: fieldIssues, fields } = validateFabricFields(body, { partial: false })

  try {
    const supabase = supabaseAdmin()

    const { issues: idIssues, productIds } = await validateProductIds(body?.productIds, supabase)
    const allIssues = [...fieldIssues, ...idIssues]
    if (allIssues.length) {
      setResponseStatus(event, 400)
      return { error: 'Invalid fabric details.', issues: allIssues }
    }

    const { data: fabric, error: insertError } = await supabase
      .from('fabrics')
      .insert({
        name: fields.name,
        slug: fields.slug,
        type: fields.type,
        status: fields.status,
        is_active: fields.isActive,
        unit: fields.unit,
        quantity: fields.quantity,
        hex_color: fields.hexColor,
        image_url: fields.imageUrl
      })
      .select('id, name, slug, type, hex_color, image_url, quantity, unit, status, is_active')
      .single()

    if (insertError || !fabric) {
      if (insertError?.code === '23505') {
        setResponseStatus(event, 409)
        return { error: 'That slug is already in use.' }
      }
      console.error('[admin/fabrics] insert failed:', insertError?.message)
      setResponseStatus(event, 500)
      return { error: 'Could not create fabric.' }
    }

    let warning = null
    let productIdsResult = []

    if (productIds && productIds.length) {
      const { error: linkError } = await supabase
        .from('product_fabrics')
        .insert(productIds.map((product_id) => ({ product_id, fabric_id: fabric.id, is_available: true })))

      if (linkError) {
        // The fabric itself was created successfully. Leaving it with no
        // relationships is a safe, visible state (shows as "not linked to
        // any product" in the admin list, invisible on the storefront) —
        // not a broken one. The admin can set compatibility via PATCH.
        console.error('[admin/fabrics] relationship insert failed for new fabric', fabric.id, linkError.message)
        warning = 'Fabric was created, but linking it to the selected products failed. Set product compatibility from the edit form.'
      } else {
        productIdsResult = productIds
      }
    }

    setResponseStatus(event, 201)
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
        productIds: productIdsResult
      },
      warning
    }
  } catch (err) {
    console.error('[admin/fabrics] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not create fabric.' }
  }
})
