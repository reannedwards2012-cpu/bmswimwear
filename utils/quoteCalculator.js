// Pure custom-quote pricing calculator. Lives in top-level utils/ (not
// server/utils/) specifically so Nuxt auto-imports it on BOTH the client
// (live pricing preview as an admin fills in the form) and the server
// (authoritative recompute before a quote is saved — the server never
// trusts a client-submitted total, same principle as Go2Pay amounts).
//
// All money is handled in integer XCD cents throughout to avoid floating
// point drift; the only rounding happens at well-defined points (fabric
// cost, labour cost, overhead allocation, deposit, and the two explicit
// "round up to nearest EC$5" steps in the brief).

export const QUOTE_CATEGORIES = ['basic_bikini', 'basic_onepiece', 'complex_custom', 'other_custom']

export const QUOTE_CATEGORY_LABELS = {
  basic_bikini: 'Basic Bikini',
  basic_onepiece: 'Basic One-Piece',
  complex_custom: 'Complex Custom',
  other_custom: 'Other/Custom',
}

export const FABRIC_TYPES = ['solid', 'printed', 'custom']

const FIVE_DOLLARS_CENTS = 500

const n = (v) => (Number.isFinite(v) ? v : Number(v) || 0)
const roundCents = (v) => Math.round(n(v))
const roundUpToNearest = (cents, stepCents) => Math.ceil(n(cents) / stepCents) * stepCents

/**
 * @param {object} input
 * @param {string} input.category - one of QUOTE_CATEGORIES
 * @param {number} input.productionHours
 * @param {number} input.labourRateXcdCents
 * @param {number} input.fabricCostPerYardXcdCents
 * @param {number} input.fabricYards
 * @param {number} input.packagingXcdCents
 * @param {number} input.consumablesXcdCents
 * @param {number} [input.additionalMaterialsXcdCents] - extra editable materials/hardware line, default 0
 * @param {number} input.electricityMonthlyXcdCents
 * @param {number} input.machineMaintenanceMonthlyXcdCents
 * @param {number} input.expectedMonthlyVolume - units/month the fixed overhead is spread across
 * @param {number} [input.designFeeXcdCents] - flat design-development fee, default 0
 * @param {number} [input.designHours] - reference-only hours, default 0
 * @param {boolean} [input.designHoursBillable] - if true, ALSO bill designHours * labourRate on top of the flat fee (prevents double counting by default)
 * @param {number} [input.fittingAllowanceXcdCents] - default 0
 * @param {number} input.targetMarginPercent - e.g. 30 for 30%
 * @param {number} input.depositPercent - e.g. 50 for 50%
 * @param {number|null} [input.categoryMinimumXcdCents] - null means no floor
 * @param {number|null} [input.finalPriceOverrideXcdCents] - manual override of the final quoted price
 * @returns {object} full snapshot of inputs + computed outputs, suitable for storing as `quotes.calculation`
 */
export function calculateQuote(input) {
  const {
    category,
    productionHours,
    labourRateXcdCents,
    fabricCostPerYardXcdCents,
    fabricYards,
    packagingXcdCents,
    consumablesXcdCents,
    additionalMaterialsXcdCents = 0,
    electricityMonthlyXcdCents,
    machineMaintenanceMonthlyXcdCents,
    expectedMonthlyVolume,
    designFeeXcdCents = 0,
    designHours = 0,
    designHoursBillable = false,
    fittingAllowanceXcdCents = 0,
    targetMarginPercent,
    depositPercent,
    categoryMinimumXcdCents = null,
    finalPriceOverrideXcdCents = null,
  } = input

  const fabricCostXcdCents = roundCents(n(fabricCostPerYardXcdCents) * n(fabricYards))
  const productionLabourXcdCents = roundCents(n(productionHours) * n(labourRateXcdCents))
  const designLabourXcdCents = designHoursBillable ? roundCents(n(designHours) * n(labourRateXcdCents)) : 0
  const designDevelopmentXcdCents = roundCents(n(designFeeXcdCents)) + designLabourXcdCents

  const volume = Math.max(1, n(expectedMonthlyVolume))
  const overheadAllocationXcdCents = roundCents(
    (n(electricityMonthlyXcdCents) + n(machineMaintenanceMonthlyXcdCents)) / volume
  )

  const estimatedCostXcdCents =
    fabricCostXcdCents +
    roundCents(packagingXcdCents) +
    roundCents(consumablesXcdCents) +
    roundCents(additionalMaterialsXcdCents) +
    productionLabourXcdCents +
    designDevelopmentXcdCents +
    roundCents(fittingAllowanceXcdCents) +
    overheadAllocationXcdCents

  const marginFraction = Math.min(0.99, Math.max(0, n(targetMarginPercent) / 100))
  const suggestedPriceRawXcdCents = marginFraction >= 0.99 ? estimatedCostXcdCents : estimatedCostXcdCents / (1 - marginFraction)
  const suggestedPriceXcdCents = roundUpToNearest(suggestedPriceRawXcdCents, FIVE_DOLLARS_CENTS)

  const minimumAppliedXcdCents =
    categoryMinimumXcdCents != null && n(categoryMinimumXcdCents) > suggestedPriceXcdCents
      ? roundUpToNearest(categoryMinimumXcdCents, FIVE_DOLLARS_CENTS)
      : null
  const flooredPriceXcdCents = minimumAppliedXcdCents != null ? minimumAppliedXcdCents : suggestedPriceXcdCents

  const finalPriceXcdCents =
    finalPriceOverrideXcdCents != null ? roundCents(finalPriceOverrideXcdCents) : flooredPriceXcdCents

  const profitXcdCents = finalPriceXcdCents - estimatedCostXcdCents
  const actualMarginPercent = finalPriceXcdCents > 0 ? (profitXcdCents / finalPriceXcdCents) * 100 : 0

  const depositXcdCents = roundCents((finalPriceXcdCents * n(depositPercent)) / 100)
  const remainingBalanceXcdCents = finalPriceXcdCents - depositXcdCents

  return {
    inputs: {
      category,
      productionHours: n(productionHours),
      labourRateXcdCents: roundCents(labourRateXcdCents),
      fabricCostPerYardXcdCents: roundCents(fabricCostPerYardXcdCents),
      fabricYards: n(fabricYards),
      packagingXcdCents: roundCents(packagingXcdCents),
      consumablesXcdCents: roundCents(consumablesXcdCents),
      additionalMaterialsXcdCents: roundCents(additionalMaterialsXcdCents),
      electricityMonthlyXcdCents: roundCents(electricityMonthlyXcdCents),
      machineMaintenanceMonthlyXcdCents: roundCents(machineMaintenanceMonthlyXcdCents),
      expectedMonthlyVolume: volume,
      designFeeXcdCents: roundCents(designFeeXcdCents),
      designHours: n(designHours),
      designHoursBillable: !!designHoursBillable,
      fittingAllowanceXcdCents: roundCents(fittingAllowanceXcdCents),
      targetMarginPercent: n(targetMarginPercent),
      depositPercent: n(depositPercent),
      categoryMinimumXcdCents: categoryMinimumXcdCents != null ? roundCents(categoryMinimumXcdCents) : null,
      finalPriceOverrideXcdCents: finalPriceOverrideXcdCents != null ? roundCents(finalPriceOverrideXcdCents) : null,
    },
    outputs: {
      fabricCostXcdCents,
      productionLabourXcdCents,
      designLabourXcdCents,
      designDevelopmentXcdCents,
      overheadAllocationXcdCents,
      estimatedCostXcdCents,
      suggestedPriceXcdCents,
      minimumAppliedXcdCents,
      finalPriceXcdCents,
      profitXcdCents,
      actualMarginPercent,
      depositXcdCents,
      remainingBalanceXcdCents,
    },
  }
}
