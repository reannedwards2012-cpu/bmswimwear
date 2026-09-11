/**
 * GET /api/admin/stockists/:id
 *
 * Admin-only. One stockist + its summary figures + its full inventory item
 * list (each item carries its own computed sell-through/retail/commission/
 * proceeds, from that item's own SOLD movements). Deliberately not paginated
 * or server-filtered — see pages/admin/stockists/[id].vue: boutique inventory
 * counts are small enough that client-side filter/sort is the right amount
 * of complexity here, same call the Products admin page already makes.
 *
 * An inactive stockist is served identically to an active one — "inactive"
 * only affects the picker on the Stockists overview / Add Inventory flow,
 * never this page. Historical inventory/sales stay fully readable.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { STOCKIST_SELECT, STOCKIST_ITEM_SELECT, mapStockist, mapInventoryItem } from '../../../utils/stockistMappers.js'
import { sellThroughPercent, summarizeSoldMovements } from '../../../utils/stockistInventory.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')

  try {
    const supabase = supabaseAdmin()

    const { data: stockistRow, error: stockistError } = await supabase
      .from('stockists')
      .select(STOCKIST_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (stockistError) {
      console.error('[admin/stockists/:id] load failed:', stockistError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load stockist.' }
    }
    if (!stockistRow) {
      setResponseStatus(event, 404)
      return { error: 'Stockist not found.' }
    }

    const [{ data: itemRows, error: itemError }, { data: soldRows, error: soldError }] = await Promise.all([
      supabase.from('stockist_inventory_items').select(STOCKIST_ITEM_SELECT).eq('stockist_id', id).order('created_at', { ascending: true }),
      supabase
        .from('stockist_inventory_movements')
        .select('item_id, quantity, sale_unit_price_cents, sale_commission_bps')
        .eq('stockist_id', id)
        .eq('movement_type', 'sold')
    ])

    if (itemError || soldError) {
      console.error('[admin/stockists/:id] items/movements query failed:', itemError?.message || soldError?.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load stockist.' }
    }

    const soldByItem = new Map()
    for (const row of soldRows ?? []) {
      const list = soldByItem.get(row.item_id) ?? []
      list.push({ quantity: row.quantity, saleUnitPriceCents: row.sale_unit_price_cents, saleCommissionBps: row.sale_commission_bps })
      soldByItem.set(row.item_id, list)
    }

    const items = (itemRows ?? []).map((row) => {
      const mapped = mapInventoryItem(row)
      const { retailCents, commissionCents, proceedsCents } = summarizeSoldMovements(soldByItem.get(row.id) ?? [])
      return {
        ...mapped,
        sellThroughPercent: sellThroughPercent(mapped.totalSoldQuantity, mapped.totalSuppliedQuantity),
        retailSalesCents: retailCents,
        commissionCents,
        proceedsCents
      }
    })

    const summary = items.reduce(
      (acc, i) => ({
        currentStock: acc.currentStock + i.remainingQuantity,
        totalSupplied: acc.totalSupplied + i.totalSuppliedQuantity,
        totalSold: acc.totalSold + i.totalSoldQuantity,
        totalReturned: acc.totalReturned + i.totalReturnedQuantity,
        totalRemoved: acc.totalRemoved + i.totalRemovedQuantity,
        retailSalesCents: acc.retailSalesCents + i.retailSalesCents,
        commissionCents: acc.commissionCents + i.commissionCents,
        proceedsCents: acc.proceedsCents + i.proceedsCents
      }),
      {
        currentStock: 0,
        totalSupplied: 0,
        totalSold: 0,
        totalReturned: 0,
        totalRemoved: 0,
        retailSalesCents: 0,
        commissionCents: 0,
        proceedsCents: 0
      }
    )
    summary.sellThroughPercent = sellThroughPercent(summary.totalSold, summary.totalSupplied)

    return { stockist: mapStockist(stockistRow), summary, items }
  } catch (err) {
    console.error('[admin/stockists/:id] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load stockist.' }
  }
})
