import { describe, it, expect } from 'vitest'
import { calculateQuote } from '../utils/quoteCalculator.js'

// A representative "Basic Bikini" quote using the exact brief defaults:
// labour EC$40/hr * 2hr = EC$80; fabric EC$70/yd * 0.5yd = EC$35;
// packaging EC$5 + consumables EC$5; overhead (EC$50 + EC$50)/20 = EC$5;
// no design development, no fitting allowance, 30% target margin.
function baseBikiniInput(overrides = {}) {
  return {
    category: 'basic_bikini',
    productionHours: 2,
    labourRateXcdCents: 4000,
    fabricCostPerYardXcdCents: 7000,
    fabricYards: 0.5,
    packagingXcdCents: 500,
    consumablesXcdCents: 500,
    electricityMonthlyXcdCents: 5000,
    machineMaintenanceMonthlyXcdCents: 5000,
    expectedMonthlyVolume: 20,
    targetMarginPercent: 30,
    depositPercent: 50,
    categoryMinimumXcdCents: 18000,
    ...overrides,
  }
}

describe('calculateQuote — cost line items', () => {
  it('computes fabric cost as rate * yards', () => {
    const { outputs } = calculateQuote(baseBikiniInput())
    expect(outputs.fabricCostXcdCents).toBe(3500) // EC$35.00
  })

  it('computes production labour as hours * rate', () => {
    const { outputs } = calculateQuote(baseBikiniInput())
    expect(outputs.productionLabourXcdCents).toBe(8000) // EC$80.00
  })

  it('allocates fixed monthly overhead across expected volume', () => {
    const { outputs } = calculateQuote(baseBikiniInput())
    // (5000 + 5000) / 20 = 500 → EC$5.00
    expect(outputs.overheadAllocationXcdCents).toBe(500)
  })

  it('sums every estimated-cost line item', () => {
    const { outputs } = calculateQuote(baseBikiniInput())
    // fabric 3500 + packaging 500 + consumables 500 + labour 8000 + overhead 500 = 13000
    expect(outputs.estimatedCostXcdCents).toBe(13000)
  })
})

describe('calculateQuote — design development double-counting prevention', () => {
  it('charges only the flat fee when designHoursBillable is false (default)', () => {
    const { outputs } = calculateQuote(
      baseBikiniInput({ designFeeXcdCents: 4000, designHours: 3, designHoursBillable: false })
    )
    expect(outputs.designLabourXcdCents).toBe(0)
    expect(outputs.designDevelopmentXcdCents).toBe(4000)
  })

  it('charges flat fee plus hourly labour only when designHoursBillable is explicitly true', () => {
    const { outputs } = calculateQuote(
      baseBikiniInput({ designFeeXcdCents: 4000, designHours: 3, designHoursBillable: true })
    )
    expect(outputs.designLabourXcdCents).toBe(12000) // 3hr * EC$40
    expect(outputs.designDevelopmentXcdCents).toBe(16000)
  })

  it('design development is zero by default (no fee, no billable hours)', () => {
    const { outputs } = calculateQuote(baseBikiniInput())
    expect(outputs.designDevelopmentXcdCents).toBe(0)
  })
})

describe('calculateQuote — margin-based suggested price', () => {
  it('suggested price = cost / (1 - margin), rounded UP to nearest EC$5', () => {
    const { outputs } = calculateQuote(baseBikiniInput({ categoryMinimumXcdCents: null }))
    // 13000 / 0.7 = 18571.43 → rounds up to nearest 500 → 19000
    expect(outputs.suggestedPriceXcdCents).toBe(19000)
  })

  it('a higher target margin produces a higher suggested price', () => {
    const low = calculateQuote(baseBikiniInput({ categoryMinimumXcdCents: null, targetMarginPercent: 20 }))
    const high = calculateQuote(baseBikiniInput({ categoryMinimumXcdCents: null, targetMarginPercent: 50 }))
    expect(high.outputs.suggestedPriceXcdCents).toBeGreaterThan(low.outputs.suggestedPriceXcdCents)
  })
})

describe('calculateQuote — category minimum flooring', () => {
  it('applies the category minimum when it exceeds the suggested price', () => {
    // suggested price here (19000) is already below the 18000 minimum's
    // sibling case below; use a cheap quote to force the floor to bite.
    const { outputs } = calculateQuote(
      baseBikiniInput({ productionHours: 0.5, fabricYards: 0.1, categoryMinimumXcdCents: 18000 })
    )
    expect(outputs.minimumAppliedXcdCents).toBe(18000)
    expect(outputs.finalPriceXcdCents).toBe(18000)
  })

  it('leaves the suggested price untouched when it already exceeds the minimum', () => {
    const { outputs } = calculateQuote(
      baseBikiniInput({ productionHours: 10, categoryMinimumXcdCents: 18000 })
    )
    expect(outputs.minimumAppliedXcdCents).toBeNull()
    expect(outputs.finalPriceXcdCents).toBe(outputs.suggestedPriceXcdCents)
  })

  it('rounds a non-multiple-of-5 minimum up to the nearest EC$5 when applied', () => {
    const { outputs } = calculateQuote(
      baseBikiniInput({ productionHours: 0.1, fabricYards: 0.01, categoryMinimumXcdCents: 18001 })
    )
    expect(outputs.minimumAppliedXcdCents).toBe(18500)
  })

  it('never applies a floor for categories with no minimum (null)', () => {
    const { outputs } = calculateQuote(
      baseBikiniInput({ productionHours: 0.1, fabricYards: 0.01, categoryMinimumXcdCents: null })
    )
    expect(outputs.minimumAppliedXcdCents).toBeNull()
  })
})

describe('calculateQuote — manual final price override', () => {
  it('uses the override instead of the suggested/floored price', () => {
    const { outputs } = calculateQuote(baseBikiniInput({ finalPriceOverrideXcdCents: 25000 }))
    expect(outputs.finalPriceXcdCents).toBe(25000)
  })

  it('recomputes profit and actual margin off the overridden final price', () => {
    const { outputs } = calculateQuote(baseBikiniInput({ finalPriceOverrideXcdCents: 25000 }))
    // estimated cost 13000, final 25000 → profit 12000, margin 12000/25000 = 48%
    expect(outputs.profitXcdCents).toBe(12000)
    expect(outputs.actualMarginPercent).toBeCloseTo(48, 5)
  })

  it('an override below cost produces a negative profit (not clamped)', () => {
    const { outputs } = calculateQuote(baseBikiniInput({ finalPriceOverrideXcdCents: 10000 }))
    expect(outputs.profitXcdCents).toBe(-3000)
  })
})

describe('calculateQuote — deposit and remaining balance', () => {
  it('deposit = final price * deposit percent', () => {
    const { outputs } = calculateQuote(baseBikiniInput({ finalPriceOverrideXcdCents: 20000, depositPercent: 50 }))
    expect(outputs.depositXcdCents).toBe(10000)
    expect(outputs.remainingBalanceXcdCents).toBe(10000)
  })

  it('a non-50% deposit percent splits the final price accordingly', () => {
    const { outputs } = calculateQuote(baseBikiniInput({ finalPriceOverrideXcdCents: 20000, depositPercent: 25 }))
    expect(outputs.depositXcdCents).toBe(5000)
    expect(outputs.remainingBalanceXcdCents).toBe(15000)
  })

  it('deposit + remaining always reconstitute the final price exactly', () => {
    const { outputs } = calculateQuote(baseBikiniInput({ finalPriceOverrideXcdCents: 19999, depositPercent: 33 }))
    expect(outputs.depositXcdCents + outputs.remainingBalanceXcdCents).toBe(outputs.finalPriceXcdCents)
  })
})

describe('calculateQuote — echoes inputs for the historical snapshot', () => {
  it('returns an inputs object capturing every value used in the calculation', () => {
    const { inputs } = calculateQuote(baseBikiniInput())
    expect(inputs.category).toBe('basic_bikini')
    expect(inputs.labourRateXcdCents).toBe(4000)
    expect(inputs.targetMarginPercent).toBe(30)
    expect(inputs.depositPercent).toBe(50)
  })
})
