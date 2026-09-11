import { describe, it, expect } from 'vitest'
import {
  applyMovement,
  sellThroughPercent,
  commissionCentsForSale,
  proceedsCentsForSale,
  retailCentsForSale,
  summarizeSoldMovements,
  topSoldBy,
  InvalidMovementError,
  InsufficientStockError
} from '../server/utils/stockistInventory.js'

function item(overrides = {}) {
  return {
    remainingQuantity: 0,
    totalSuppliedQuantity: 0,
    totalSoldQuantity: 0,
    totalReturnedQuantity: 0,
    totalRemovedQuantity: 0,
    ...overrides
  }
}

// ── applyMovement — the core "remaining = sent + restocked - sold - returned - removed" rule ──
describe('applyMovement', () => {
  it('SENT / initial stock increases remaining and totalSupplied', () => {
    const result = applyMovement(item(), { type: 'sent', quantity: 3 })
    expect(result).toMatchObject({ remainingQuantity: 3, totalSuppliedQuantity: 3 })
  })

  it('RESTOCK increases remaining and totalSupplied', () => {
    const result = applyMovement(item({ remainingQuantity: 2, totalSuppliedQuantity: 3 }), { type: 'restock', quantity: 2 })
    expect(result).toMatchObject({ remainingQuantity: 4, totalSuppliedQuantity: 5 })
  })

  it('SOLD decreases remaining and increases totalSold, leaves totalSupplied unchanged', () => {
    const result = applyMovement(item({ remainingQuantity: 3, totalSuppliedQuantity: 3 }), { type: 'sold', quantity: 1 })
    expect(result).toMatchObject({ remainingQuantity: 2, totalSuppliedQuantity: 3, totalSoldQuantity: 1 })
  })

  it('RETURNED decreases remaining and increases totalReturned', () => {
    const result = applyMovement(item({ remainingQuantity: 2 }), { type: 'returned', quantity: 1 })
    expect(result).toMatchObject({ remainingQuantity: 1, totalReturnedQuantity: 1 })
  })

  it('REMOVED decreases remaining and increases totalRemoved', () => {
    const result = applyMovement(item({ remainingQuantity: 2 }), { type: 'removed', quantity: 2 })
    expect(result).toMatchObject({ remainingQuantity: 0, totalRemovedQuantity: 2 })
  })

  it('cannot sell more than remaining', () => {
    expect(() => applyMovement(item({ remainingQuantity: 1 }), { type: 'sold', quantity: 2 })).toThrow(InsufficientStockError)
  })

  it('cannot return more than remaining', () => {
    expect(() => applyMovement(item({ remainingQuantity: 1 }), { type: 'returned', quantity: 2 })).toThrow(InsufficientStockError)
  })

  it('cannot remove more than remaining', () => {
    expect(() => applyMovement(item({ remainingQuantity: 1 }), { type: 'removed', quantity: 5 })).toThrow(InsufficientStockError)
  })

  it('remaining never goes negative — selling exactly what remains is fine, one more is not', () => {
    const afterFinalSale = applyMovement(item({ remainingQuantity: 1, totalSuppliedQuantity: 1 }), { type: 'sold', quantity: 1 })
    expect(afterFinalSale.remainingQuantity).toBe(0)
    expect(() => applyMovement(afterFinalSale, { type: 'sold', quantity: 1 })).toThrow(InsufficientStockError)
  })

  it('rejects an unknown movement type', () => {
    expect(() => applyMovement(item(), { type: 'discarded', quantity: 1 })).toThrow(InvalidMovementError)
  })

  it('rejects a zero or negative quantity', () => {
    expect(() => applyMovement(item(), { type: 'restock', quantity: 0 })).toThrow(InvalidMovementError)
    expect(() => applyMovement(item(), { type: 'restock', quantity: -1 })).toThrow(InvalidMovementError)
  })

  it('rejects a non-integer quantity', () => {
    expect(() => applyMovement(item(), { type: 'restock', quantity: 1.5 })).toThrow(InvalidMovementError)
  })

  it(
    'concurrency-safety math: two "sell the last unit" requests applied in the order the DB\'s ' +
      'row lock would serialize them — the second always fails once the first has consumed the last unit. ' +
      '(record_stockist_movement()\'s `select ... for update` is what guarantees requests are actually ' +
      'serialized in this order under real concurrency; that row lock can only be exercised against a live ' +
      'Postgres instance, not in vitest — this test proves the shared arithmetic behind it is correct.)',
    () => {
      let current = item({ remainingQuantity: 1, totalSuppliedQuantity: 1 })
      current = applyMovement(current, { type: 'sold', quantity: 1 }) // request A wins the race
      expect(current.remainingQuantity).toBe(0)
      expect(() => applyMovement(current, { type: 'sold', quantity: 1 })).toThrow(InsufficientStockError) // request B loses
    }
  )
})

// ── sell-through % ──
describe('sellThroughPercent', () => {
  it('sold / supplied * 100', () => {
    expect(sellThroughPercent(1, 3)).toBeCloseTo(33.333, 2)
    expect(sellThroughPercent(3, 3)).toBe(100)
    expect(sellThroughPercent(0, 3)).toBe(0)
  })
  it('0 supplied -> 0, never NaN/Infinity', () => {
    expect(sellThroughPercent(0, 0)).toBe(0)
    expect(sellThroughPercent(5, 0)).toBe(0)
  })
})

// ── money: retail / commission / proceeds ──
describe('sale money math (integer cents, commission in basis points)', () => {
  it('EC$180 retail, 15% commission -> EC$27 commission, EC$153 proceeds (brief\'s own example)', () => {
    expect(retailCentsForSale(18000, 1)).toBe(18000)
    expect(commissionCentsForSale(18000, 1, 1500)).toBe(2700)
    expect(proceedsCentsForSale(18000, 1, 1500)).toBe(15300)
  })

  it('scales with quantity', () => {
    expect(retailCentsForSale(18000, 3)).toBe(54000)
    expect(commissionCentsForSale(18000, 3, 1500)).toBe(8100)
    expect(proceedsCentsForSale(18000, 3, 1500)).toBe(45900)
  })

  it('rounds commission to the nearest cent', () => {
    // 999 cents * 1 * 1500bps / 10000 = 149.85 -> 150
    expect(commissionCentsForSale(999, 1, 1500)).toBe(150)
  })

  it('0% commission -> all proceeds, no commission', () => {
    expect(commissionCentsForSale(10000, 1, 0)).toBe(0)
    expect(proceedsCentsForSale(10000, 1, 0)).toBe(10000)
  })
})

describe('summarizeSoldMovements', () => {
  it('sums retail/commission/proceeds across lines with DIFFERENT snapshotted prices/commissions', () => {
    const result = summarizeSoldMovements([
      { quantity: 1, saleUnitPriceCents: 18000, saleCommissionBps: 1500 }, // 18000 / 2700 / 15300
      { quantity: 2, saleUnitPriceCents: 20000, saleCommissionBps: 2000 } // 40000 / 8000 / 32000
    ])
    expect(result).toEqual({ retailCents: 58000, commissionCents: 10700, proceedsCents: 47300 })
  })

  it('empty list -> all zero', () => {
    expect(summarizeSoldMovements([])).toEqual({ retailCents: 0, commissionCents: 0, proceedsCents: 0 })
  })

  it(
    'commission snapshot on a past sale is unaffected by the stockist/item default changing later — ' +
      'summarizeSoldMovements only ever reads each movement\'s OWN saleCommissionBps, never a default passed in',
    () => {
      const historicalSale = { quantity: 1, saleUnitPriceCents: 18000, saleCommissionBps: 1500 } // sold when default was 15%
      const resultBeforeDefaultChange = summarizeSoldMovements([historicalSale])
      // the stockist's default_commission_bps changing later (e.g. to 2000) is never passed to this
      // function at all — there is no "current default" parameter for it to read.
      const resultAfterDefaultChange = summarizeSoldMovements([historicalSale])
      expect(resultAfterDefaultChange).toEqual(resultBeforeDefaultChange)
      expect(resultAfterDefaultChange.commissionCents).toBe(2700)
    }
  )
})

// ── cross-stockist insights grouping (distinct variants stay distinct) ──
describe('topSoldBy', () => {
  it('groups by key and sums quantity, ranked descending', () => {
    const sold = [
      { quantity: 2, productName: 'Mimosa' },
      { quantity: 1, productName: 'Mimosa' },
      { quantity: 4, productName: 'Gimlet' }
    ]
    expect(topSoldBy(sold, (m) => m.productName)).toEqual([
      { key: 'Gimlet', quantitySold: 4 },
      { key: 'Mimosa', quantitySold: 3 }
    ])
  })

  it('different variants (size) are NOT merged even for the same product/colour', () => {
    const sold = [
      { quantity: 2, key: 'Mimosa / Black / M / Cheeky' },
      { quantity: 5, key: 'Mimosa / Black / L / Cheeky' },
      { quantity: 1, key: 'Mimosa / Black / M / Bikini' }
    ]
    const result = topSoldBy(sold, (m) => m.key)
    expect(result).toHaveLength(3)
    expect(result.find((r) => r.key === 'Mimosa / Black / M / Cheeky').quantitySold).toBe(2)
    expect(result.find((r) => r.key === 'Mimosa / Black / L / Cheeky').quantitySold).toBe(5)
    expect(result.find((r) => r.key === 'Mimosa / Black / M / Bikini').quantitySold).toBe(1)
  })

  it('skips null/blank keys and respects the limit', () => {
    const sold = [{ quantity: 1, k: null }, { quantity: 1, k: 'A' }, { quantity: 1, k: 'B' }, { quantity: 1, k: 'C' }]
    expect(topSoldBy(sold, (m) => m.k, 2)).toHaveLength(2)
  })
})
