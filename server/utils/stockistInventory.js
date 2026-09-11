/**
 * Pure calculation/business-logic helpers for Stockists / Boutique Inventory.
 * No Supabase calls here — everything is a plain function over plain data,
 * which is what makes it exhaustively unit-testable (see test/stockistInventory.test.js).
 *
 * `applyMovement()` mirrors — deliberately, line for line — the arithmetic in
 * the `record_stockist_movement()` Postgres function
 * (supabase/migrations/20260911120000_stockists.sql). That SQL function is
 * the actual source of truth in production (it holds the row lock that makes
 * concurrent sales safe); this JS copy exists so the same rules can be unit
 * tested without a live database, and so the admin API can return a fast,
 * friendly 400 before ever calling the database for an obviously-bad request.
 * If you change one, change the other.
 */

export const MOVEMENT_TYPES = ['sent', 'restock', 'sold', 'returned', 'removed']
export const INCREASE_MOVEMENT_TYPES = ['sent', 'restock']
export const DECREASE_MOVEMENT_TYPES = ['sold', 'returned', 'removed']

// Commission is stored as integer basis points (1/100 of a percent) —
// 1500 = 15.00% — the same "no floats" spirit as the app's existing
// integer-cents money columns (see utils/money.js).
export const BPS_DENOMINATOR = 10000

export class InvalidMovementError extends Error {
  constructor(message) {
    super(message)
    this.name = 'InvalidMovementError'
  }
}

export class InsufficientStockError extends Error {
  constructor(message, { remaining } = {}) {
    super(message)
    this.name = 'InsufficientStockError'
    this.remaining = remaining
  }
}

/**
 * Validate + apply one movement to an item's current aggregate quantities.
 * Throws InvalidMovementError / InsufficientStockError instead of ever
 * returning a negative `remainingQuantity`.
 *
 * @param {{remainingQuantity:number, totalSuppliedQuantity:number, totalSoldQuantity:number, totalReturnedQuantity:number, totalRemovedQuantity:number}} item
 * @param {{type:string, quantity:number}} movement
 * @returns the item's four aggregate fields, updated
 */
export function applyMovement(item, { type, quantity }) {
  if (!MOVEMENT_TYPES.includes(type)) {
    throw new InvalidMovementError(`Unknown movement type "${type}".`)
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new InvalidMovementError('Quantity must be a whole number greater than zero.')
  }

  const isIncrease = INCREASE_MOVEMENT_TYPES.includes(type)
  const remainingQuantity = isIncrease ? item.remainingQuantity + quantity : item.remainingQuantity - quantity

  if (remainingQuantity < 0) {
    throw new InsufficientStockError(
      `Not enough remaining stock — ${item.remainingQuantity} left, ${quantity} requested.`,
      { remaining: item.remainingQuantity }
    )
  }

  return {
    remainingQuantity,
    totalSuppliedQuantity: item.totalSuppliedQuantity + (isIncrease ? quantity : 0),
    totalSoldQuantity: item.totalSoldQuantity + (type === 'sold' ? quantity : 0),
    totalReturnedQuantity: item.totalReturnedQuantity + (type === 'returned' ? quantity : 0),
    totalRemovedQuantity: item.totalRemovedQuantity + (type === 'removed' ? quantity : 0)
  }
}

/**
 * sell-through % = sold / total supplied * 100. 0 supplied -> 0 (not NaN/Infinity).
 * Returns/removals never factor in — only `sold` and `totalSupplied` do.
 */
export function sellThroughPercent(soldQuantity, totalSuppliedQuantity) {
  if (!totalSuppliedQuantity) return 0
  return (soldQuantity / totalSuppliedQuantity) * 100
}

/** Retail value of one sale line: unit price (cents) × quantity. */
export function retailCentsForSale(saleUnitPriceCents, quantity) {
  return saleUnitPriceCents * quantity
}

/** The boutique's cut of one sale line, from ITS OWN snapshotted commission — never a live lookup. */
export function commissionCentsForSale(saleUnitPriceCents, quantity, saleCommissionBps) {
  return Math.round((saleUnitPriceCents * quantity * saleCommissionBps) / BPS_DENOMINATOR)
}

/** Bahama Mama's proceeds from one sale line: retail − boutique commission. */
export function proceedsCentsForSale(saleUnitPriceCents, quantity, saleCommissionBps) {
  return retailCentsForSale(saleUnitPriceCents, quantity) - commissionCentsForSale(saleUnitPriceCents, quantity, saleCommissionBps)
}

/**
 * Reduce a list of SOLD movements — `{quantity, saleUnitPriceCents, saleCommissionBps}`
 * — into totals. Each line uses only its OWN snapshotted price/commission, so
 * this is stable even if the item's retail price or the stockist's default
 * commission changes afterwards.
 */
export function summarizeSoldMovements(movements) {
  let retailCents = 0
  let commissionCents = 0
  for (const m of movements) {
    retailCents += retailCentsForSale(m.saleUnitPriceCents, m.quantity)
    commissionCents += commissionCentsForSale(m.saleUnitPriceCents, m.quantity, m.saleCommissionBps)
  }
  return { retailCents, commissionCents, proceedsCents: retailCents - commissionCents }
}

/**
 * Top N keys by quantity sold, for the lightweight cross-stockist insight
 * cards (best-selling product / colour / size / coverage). `keyFn` extracts
 * the grouping key from a sold movement already joined to its item (e.g.
 * `(m) => m.productName`); movements with a null/blank key are skipped.
 */
export function topSoldBy(soldMovements, keyFn, limit = 5) {
  const totals = new Map()
  for (const m of soldMovements) {
    const key = keyFn(m)
    if (!key) continue
    totals.set(key, (totals.get(key) ?? 0) + m.quantity)
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, quantitySold]) => ({ key, quantitySold }))
}
