/**
 * DB row → admin API shape mapping for Stockists / Boutique Inventory.
 * Mirrors the style of server/utils/productMappers.js / orderMappers.js.
 */

export const STOCKIST_SELECT =
  'id, name, location, contact_name, phone, email, default_commission_bps, notes, is_active, created_at'

export const STOCKIST_ITEM_SELECT = `
  id, stockist_id, source, product_id, product_name_snapshot, product_image_snapshot,
  reference_code, colour, size, coverage, retail_price_cents, currency, default_commission_bps,
  notes, remaining_quantity, total_supplied_quantity, total_sold_quantity, total_returned_quantity,
  total_removed_quantity, first_sent_at, is_archived, created_at
`.trim()

export const STOCKIST_MOVEMENT_SELECT =
  'id, stockist_id, item_id, movement_type, quantity, occurred_on, note, sale_unit_price_cents, sale_commission_bps, created_by, created_at'

export function mapStockist(row) {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    defaultCommissionBps: row.default_commission_bps,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at
  }
}

export function mapInventoryItem(row) {
  return {
    id: row.id,
    stockistId: row.stockist_id,
    source: row.source,
    productId: row.product_id,
    productName: row.product_name_snapshot,
    productImage: row.product_image_snapshot,
    referenceCode: row.reference_code,
    colour: row.colour,
    size: row.size,
    coverage: row.coverage,
    retailPriceCents: row.retail_price_cents,
    currency: row.currency,
    defaultCommissionBps: row.default_commission_bps,
    notes: row.notes,
    remainingQuantity: row.remaining_quantity,
    totalSuppliedQuantity: row.total_supplied_quantity,
    totalSoldQuantity: row.total_sold_quantity,
    totalReturnedQuantity: row.total_returned_quantity,
    totalRemovedQuantity: row.total_removed_quantity,
    firstSentAt: row.first_sent_at,
    isArchived: row.is_archived,
    createdAt: row.created_at
  }
}

export function mapMovement(row) {
  return {
    id: row.id,
    stockistId: row.stockist_id,
    itemId: row.item_id,
    type: row.movement_type,
    quantity: row.quantity,
    occurredOn: row.occurred_on,
    note: row.note,
    saleUnitPriceCents: row.sale_unit_price_cents,
    saleCommissionBps: row.sale_commission_bps,
    createdBy: row.created_by,
    createdAt: row.created_at
  }
}
