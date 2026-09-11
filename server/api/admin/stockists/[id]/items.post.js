/**
 * POST /api/admin/stockists/:id/items
 *
 * Admin-only. Adds one inventory item (a website product variant OR a manual
 * item — see server/utils/stockistValidation.js `validateInventoryItemFields`)
 * and records its initial SENT movement — ATOMICALLY, via the single
 * `create_stockist_inventory_item()` Postgres function (see the migration),
 * which inserts the item row and calls record_stockist_movement() for the
 * initial SENT movement inside ONE function call / transaction. There is no
 * app-level "insert item, then insert movement, roll back by hand if the
 * second fails" step here on purpose — that pattern has an unavoidable gap
 * (a crash/network drop between the two calls) that only a single DB
 * transaction can close. The item and its initial SENT movement are created
 * together or not at all.
 *
 * For a website product item (source: 'product'), the client sends
 * productId + the chosen colour/size/coverage; this endpoint independently
 * re-fetches that product's name/primary image from `products` and stores
 * THOSE as the snapshot — never whatever the client claims the name/image
 * is, and never a live join read later (see the migration file's comment on
 * product_name_snapshot). That lookup is read-only, so it doesn't need to be
 * part of the same transaction as the write.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { validateInventoryItemFields } from '../../../../utils/stockistValidation.js'
import { mapInventoryItem, mapMovement } from '../../../../utils/stockistMappers.js'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event) // throws 401 / 403

  const stockistId = getRouterParam(event, 'id')
  const body = await readBody(event).catch(() => null)
  const { issues, fields } = validateInventoryItemFields(body, { partial: false })
  if (issues.length) {
    setResponseStatus(event, 400)
    return { error: 'Invalid inventory item details.', issues }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: stockistRow, error: stockistError } = await supabase
      .from('stockists')
      .select('id')
      .eq('id', stockistId)
      .maybeSingle()
    if (stockistError) {
      console.error('[admin/stockists/:id/items] stockist lookup failed:', stockistError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not add inventory item.' }
    }
    if (!stockistRow) {
      setResponseStatus(event, 404)
      return { error: 'Stockist not found.' }
    }

    let nameSnapshot = fields.productNameSnapshot
    let imageSnapshot = fields.productImageSnapshot ?? null

    if (fields.source === 'product') {
      // Authoritative name/image come from the live product row, not the client.
      const { data: productRow, error: productError } = await supabase
        .from('products')
        .select('name, product_images(image_url, sort_order, is_primary)')
        .eq('id', fields.productId)
        .maybeSingle()
      if (productError) {
        console.error('[admin/stockists/:id/items] product lookup failed:', productError.message)
        setResponseStatus(event, 500)
        return { error: 'Could not add inventory item.' }
      }
      if (!productRow) {
        setResponseStatus(event, 400)
        return { error: 'That product could not be found.' }
      }
      nameSnapshot = productRow.name
      const imgs = productRow.product_images ?? []
      const primary = imgs.find((i) => i.is_primary)
      imageSnapshot = primary
        ? primary.image_url
        : imgs.length
          ? [...imgs].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0].image_url
          : null
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_stockist_inventory_item', {
      p_stockist_id: stockistId,
      p_source: fields.source,
      p_product_id: fields.productId,
      p_product_name_snapshot: nameSnapshot,
      p_product_image_snapshot: imageSnapshot,
      p_reference_code: fields.referenceCode ?? null,
      p_colour: fields.colour ?? null,
      p_size: fields.size ?? null,
      p_coverage: fields.coverage ?? null,
      p_retail_price_cents: fields.retailPriceCents,
      p_default_commission_bps: fields.defaultCommissionBps,
      p_notes: fields.notes ?? null,
      p_initial_quantity: fields.initialQuantity,
      p_date_sent: fields.dateSent,
      p_created_by: admin.id
    })

    if (rpcError || !rpcResult) {
      // Nothing was written — create_stockist_inventory_item() rolled its own
      // transaction back (see the migration), so there is no partially-created
      // item to clean up here.
      if (/insufficient remaining stock/i.test(rpcError?.message || '')) {
        // Unreachable for a fresh item (remaining always starts at 0 and this
        // is always an increase), kept only for a sane message if it ever were.
        setResponseStatus(event, 400)
        return { error: 'Not enough remaining stock for this action.' }
      }
      console.error('[admin/stockists/:id/items] create_stockist_inventory_item failed:', rpcError?.message)
      setResponseStatus(event, 500)
      return { error: 'Could not add inventory item.' }
    }

    setResponseStatus(event, 201)
    return { item: mapInventoryItem(rpcResult.item), movement: mapMovement(rpcResult.movement) }
  } catch (err) {
    console.error('[admin/stockists/:id/items] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not add inventory item.' }
  }
})
