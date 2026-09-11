/**
 * POST /api/admin/stockists/:id/items/:itemId/movements
 *
 * Admin-only. Records one Restock / Mark Sold / Return / Remove movement
 * ('sent' is created only by item creation — see items.post.js — and is
 * rejected here by validateMovementInput). This is the ONLY endpoint that
 * changes an item's quantities, and it does so exclusively via the
 * `record_stockist_movement()` Postgres function (supabase/migrations/
 * 20260911120000_stockists.sql), which holds a row lock on the item for the
 * duration of its transaction — so two requests racing to sell the last unit
 * can never both succeed (the second re-reads the post-lock remaining
 * quantity and is correctly rejected). See server/utils/stockistInventory.js
 * for the equivalent (unit-tested) arithmetic and a note on why this
 * concurrency guarantee specifically requires the DB function, not
 * sequential app-code reads/writes.
 */
import { supabaseAdmin } from '../../../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../../../utils/authUser.js'
import { validateMovementInput } from '../../../../../../utils/stockistValidation.js'
import { mapInventoryItem, mapMovement } from '../../../../../../utils/stockistMappers.js'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event) // throws 401 / 403

  const itemId = getRouterParam(event, 'itemId')
  const body = await readBody(event).catch(() => null)
  const { issues, fields } = validateMovementInput(body)
  if (issues.length) {
    setResponseStatus(event, 400)
    return { error: 'Invalid movement details.', issues }
  }

  try {
    const supabase = supabaseAdmin()
    const { data: rpcResult, error } = await supabase.rpc('record_stockist_movement', {
      p_item_id: itemId,
      p_movement_type: fields.type,
      p_quantity: fields.quantity,
      p_occurred_on: fields.occurredOn,
      p_note: fields.note,
      p_sale_unit_price_cents: fields.saleUnitPriceCents,
      p_sale_commission_bps: fields.saleCommissionBps,
      p_created_by: admin.id
    })

    if (error) {
      if (/insufficient remaining stock/i.test(error.message || '')) {
        setResponseStatus(event, 400)
        return { error: 'Not enough remaining stock for this action.' }
      }
      if (/not found/i.test(error.message || '')) {
        setResponseStatus(event, 404)
        return { error: 'Inventory item not found.' }
      }
      console.error('[admin/.../movements] rpc failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not record this movement.' }
    }
    if (!rpcResult) {
      setResponseStatus(event, 404)
      return { error: 'Inventory item not found.' }
    }

    setResponseStatus(event, 201)
    return { item: mapInventoryItem(rpcResult.item), movement: mapMovement(rpcResult.movement) }
  } catch (err) {
    console.error('[admin/.../movements] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not record this movement.' }
  }
})
