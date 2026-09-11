/**
 * GET /api/admin/stockists
 *
 * Admin-only. Every stockist (active + inactive — see server/utils/orderStatus.js
 * for why the rest of this app treats "inactive"/"archived" as a filter, never
 * a delete) with summary figures, plus the total row and a few lightweight
 * cross-stockist insight cards (section 10 of the brief: best-selling
 * product/colour/size/coverage, best sell-through stockist).
 *
 * All financial/quantity figures are computed HERE from
 * stockist_inventory_items' server-maintained aggregate columns (see
 * record_stockist_movement() in the migration) and from the SOLD movements —
 * never trusted from the client, never stored redundantly beyond those
 * DB-maintained aggregates.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { STOCKIST_SELECT, mapStockist } from '../../../utils/stockistMappers.js'
import { sellThroughPercent, summarizeSoldMovements, topSoldBy } from '../../../utils/stockistInventory.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  try {
    const supabase = supabaseAdmin()

    const [{ data: stockistRows, error: stockistError }, { data: itemRows, error: itemError }] = await Promise.all([
      supabase.from('stockists').select(STOCKIST_SELECT).order('name', { ascending: true }),
      supabase
        .from('stockist_inventory_items')
        .select(
          'id, stockist_id, product_name_snapshot, colour, size, coverage, remaining_quantity, total_supplied_quantity, total_sold_quantity'
        )
    ])

    if (stockistError || itemError) {
      console.error('[admin/stockists] list query failed:', stockistError?.message || itemError?.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load stockists.' }
    }

    // Sold movements joined to just enough item context for insights grouping.
    const { data: soldRows, error: soldError } = await supabase
      .from('stockist_inventory_movements')
      .select(
        'stockist_id, item_id, quantity, sale_unit_price_cents, sale_commission_bps, stockist_inventory_items(product_name_snapshot, colour, size, coverage)'
      )
      .eq('movement_type', 'sold')

    if (soldError) {
      console.error('[admin/stockists] sold movements query failed:', soldError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load stockists.' }
    }

    const soldByStockist = new Map()
    for (const row of soldRows ?? []) {
      const list = soldByStockist.get(row.stockist_id) ?? []
      list.push({
        quantity: row.quantity,
        saleUnitPriceCents: row.sale_unit_price_cents,
        saleCommissionBps: row.sale_commission_bps
      })
      soldByStockist.set(row.stockist_id, list)
    }

    const itemsByStockist = new Map()
    for (const row of itemRows ?? []) {
      const list = itemsByStockist.get(row.stockist_id) ?? []
      list.push(row)
      itemsByStockist.set(row.stockist_id, list)
    }

    const stockists = (stockistRows ?? []).map((row) => {
      const items = itemsByStockist.get(row.id) ?? []
      const currentStock = items.reduce((sum, i) => sum + i.remaining_quantity, 0)
      const totalSupplied = items.reduce((sum, i) => sum + i.total_supplied_quantity, 0)
      const totalSold = items.reduce((sum, i) => sum + i.total_sold_quantity, 0)
      const { retailCents, commissionCents, proceedsCents } = summarizeSoldMovements(soldByStockist.get(row.id) ?? [])

      return {
        ...mapStockist(row),
        itemCount: items.length,
        currentStock,
        totalSupplied,
        totalSold,
        sellThroughPercent: sellThroughPercent(totalSold, totalSupplied),
        retailSalesCents: retailCents,
        commissionCents,
        proceedsCents
      }
    })

    const totals = stockists.reduce(
      (acc, s) => ({
        currentStock: acc.currentStock + s.currentStock,
        totalSupplied: acc.totalSupplied + s.totalSupplied,
        totalSold: acc.totalSold + s.totalSold,
        retailSalesCents: acc.retailSalesCents + s.retailSalesCents,
        commissionCents: acc.commissionCents + s.commissionCents,
        proceedsCents: acc.proceedsCents + s.proceedsCents
      }),
      { currentStock: 0, totalSupplied: 0, totalSold: 0, retailSalesCents: 0, commissionCents: 0, proceedsCents: 0 }
    )
    totals.sellThroughPercent = sellThroughPercent(totals.totalSold, totals.totalSupplied)

    // Cross-stockist insights — all sold movements flattened with their item's
    // variant context. "Best sell-through stockist" needs at least a few
    // units supplied to avoid a 1-of-1 sale reading as 100%.
    const allSold = (soldRows ?? []).map((row) => ({
      quantity: row.quantity,
      productName: row.stockist_inventory_items?.product_name_snapshot ?? null,
      colour: row.stockist_inventory_items?.colour ?? null,
      size: row.stockist_inventory_items?.size ?? null,
      coverage: row.stockist_inventory_items?.coverage ?? null
    }))

    const bestSellThrough = stockists
      .filter((s) => s.totalSupplied >= 3)
      .sort((a, b) => b.sellThroughPercent - a.sellThroughPercent)[0]

    const insights = {
      topProducts: topSoldBy(allSold, (m) => m.productName),
      topColours: topSoldBy(allSold, (m) => m.colour),
      topSizes: topSoldBy(allSold, (m) => m.size),
      topCoverage: topSoldBy(allSold, (m) => m.coverage),
      bestSellThroughStockist: bestSellThrough
        ? { id: bestSellThrough.id, name: bestSellThrough.name, sellThroughPercent: bestSellThrough.sellThroughPercent }
        : null
    }

    return { stockists, totals, insights }
  } catch (err) {
    console.error('[admin/stockists] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load stockists.' }
  }
})
