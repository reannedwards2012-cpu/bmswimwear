/**
 * PATCH /api/admin/stockists/:id/items/:itemId
 *
 * Admin-only. Edits an inventory item's non-quantity fields — retail price,
 * default commission (the pre-fill for future sales only), colour/size/
 * coverage/reference/notes corrections, and the archive flag. Quantities
 * (remaining/supplied/sold/returned/removed) are NEVER writable here — the
 * only way they change is POST .../movements (server/utils/stockistInventory.js
 * `applyMovement` / the record_stockist_movement() DB function).
 */
import { supabaseAdmin } from '../../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../../utils/authUser.js'
import { validateInventoryItemFields } from '../../../../../utils/stockistValidation.js'
import { STOCKIST_ITEM_SELECT, mapInventoryItem } from '../../../../../utils/stockistMappers.js'

const COLUMN_BY_FIELD = {
  referenceCode: 'reference_code',
  colour: 'colour',
  size: 'size',
  coverage: 'coverage',
  retailPriceCents: 'retail_price_cents',
  defaultCommissionBps: 'default_commission_bps',
  notes: 'notes',
  isArchived: 'is_archived'
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const stockistId = getRouterParam(event, 'id')
  const itemId = getRouterParam(event, 'itemId')
  const body = await readBody(event).catch(() => null)
  const { issues, fields } = validateInventoryItemFields(body, { partial: true })
  if (issues.length) {
    setResponseStatus(event, 400)
    return { error: 'Invalid inventory item details.', issues }
  }

  const patch = { updated_at: new Date().toISOString() }
  for (const [key, column] of Object.entries(COLUMN_BY_FIELD)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) patch[column] = fields[key]
  }
  if (Object.keys(patch).length === 1) {
    setResponseStatus(event, 400)
    return { error: 'No changes were provided.' }
  }

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('stockist_inventory_items')
      .update(patch)
      .eq('id', itemId)
      .eq('stockist_id', stockistId)
      .select(STOCKIST_ITEM_SELECT)
      .maybeSingle()

    if (error) {
      console.error('[admin/stockists/:id/items/:itemId] update failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update inventory item.' }
    }
    if (!data) {
      setResponseStatus(event, 404)
      return { error: 'Inventory item not found.' }
    }

    return { item: mapInventoryItem(data) }
  } catch (err) {
    console.error('[admin/stockists/:id/items/:itemId] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update inventory item.' }
  }
})
