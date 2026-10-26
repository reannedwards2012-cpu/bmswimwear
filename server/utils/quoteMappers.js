/**
 * DB row → admin API shape mapping for the Custom Quote Calculator.
 * Mirrors the style of server/utils/bikiniMixMappers.js.
 */

export const formatQuoteNumber = (n) => `QT-${String(n).padStart(6, '0')}`

export const QUOTE_LIST_SELECT = `
  id, quote_number, status, customer_name, customer_email, customer_phone,
  description, category, final_price_xcd_cents, created_at, updated_at
`.trim()

export const QUOTE_DETAIL_SELECT = `
  id, quote_number, status, customer_name, customer_email, customer_phone,
  description, category, inspiration_image_urls, calculation, final_price_xcd_cents,
  customer_notes, admin_notes, created_at, updated_at
`.trim()

export function mapQuoteListItem(row) {
  return {
    id: row.id,
    quoteNumber: formatQuoteNumber(row.quote_number),
    status: row.status,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    description: row.description,
    category: row.category,
    finalPriceXcdCents: row.final_price_xcd_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function mapQuoteDetail(row) {
  return {
    id: row.id,
    quoteNumber: formatQuoteNumber(row.quote_number),
    status: row.status,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    description: row.description,
    category: row.category,
    inspirationImageUrls: row.inspiration_image_urls ?? [],
    calculation: row.calculation,
    finalPriceXcdCents: row.final_price_xcd_cents,
    customerNotes: row.customer_notes,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/**
 * The customer-facing summary — deliberately a hand-picked allowlist, not a
 * filtered version of mapQuoteDetail, so a future internal-field addition
 * can never leak through here by accident (same pattern as
 * bikiniMixMappers.mapPublicEvent). Never includes `calculation`, category,
 * or anything cost/margin/labour related.
 */
export function mapQuoteCustomerSummary(row) {
  const outputs = row.calculation?.outputs ?? {}
  return {
    quoteNumber: formatQuoteNumber(row.quote_number),
    customerName: row.customer_name,
    description: row.description,
    finalPriceXcdCents: row.final_price_xcd_cents,
    depositXcdCents: outputs.depositXcdCents ?? null,
    remainingBalanceXcdCents: outputs.remainingBalanceXcdCents ?? null,
    customerNotes: row.customer_notes
  }
}

export const PRICING_SETTINGS_SELECT = `
  id, labour_rate_xcd_cents,
  default_hours_basic_bikini, default_hours_basic_onepiece, default_hours_complex_custom,
  fabric_cost_solid_xcd_cents, fabric_cost_printed_xcd_cents,
  fabric_consumption_bikini_yards, fabric_consumption_onepiece_yards,
  packaging_xcd_cents, consumables_xcd_cents,
  electricity_monthly_xcd_cents, machine_maintenance_monthly_xcd_cents, expected_monthly_volume,
  design_fee_minor_xcd_cents, design_fee_new_xcd_cents, design_fee_complex_xcd_cents,
  fitting_allowance_xcd_cents, target_margin_percent, deposit_percent,
  min_price_basic_bikini_xcd_cents, min_price_basic_onepiece_xcd_cents,
  min_price_complex_custom_xcd_cents, min_price_other_custom_xcd_cents,
  updated_at
`.trim()

export function mapPricingSettings(row) {
  return {
    labourRateXcdCents: row.labour_rate_xcd_cents,
    defaultHoursBasicBikini: row.default_hours_basic_bikini,
    defaultHoursBasicOnepiece: row.default_hours_basic_onepiece,
    defaultHoursComplexCustom: row.default_hours_complex_custom,
    fabricCostSolidXcdCents: row.fabric_cost_solid_xcd_cents,
    fabricCostPrintedXcdCents: row.fabric_cost_printed_xcd_cents,
    fabricConsumptionBikiniYards: row.fabric_consumption_bikini_yards,
    fabricConsumptionOnepieceYards: row.fabric_consumption_onepiece_yards,
    packagingXcdCents: row.packaging_xcd_cents,
    consumablesXcdCents: row.consumables_xcd_cents,
    electricityMonthlyXcdCents: row.electricity_monthly_xcd_cents,
    machineMaintenanceMonthlyXcdCents: row.machine_maintenance_monthly_xcd_cents,
    expectedMonthlyVolume: row.expected_monthly_volume,
    designFeeMinorXcdCents: row.design_fee_minor_xcd_cents,
    designFeeNewXcdCents: row.design_fee_new_xcd_cents,
    designFeeComplexXcdCents: row.design_fee_complex_xcd_cents,
    fittingAllowanceXcdCents: row.fitting_allowance_xcd_cents,
    targetMarginPercent: row.target_margin_percent,
    depositPercent: row.deposit_percent,
    minPriceBasicBikiniXcdCents: row.min_price_basic_bikini_xcd_cents,
    minPriceBasicOnepieceXcdCents: row.min_price_basic_onepiece_xcd_cents,
    minPriceComplexCustomXcdCents: row.min_price_complex_custom_xcd_cents,
    minPriceOtherCustomXcdCents: row.min_price_other_custom_xcd_cents,
    updatedAt: row.updated_at
  }
}

/** category -> the pricing-settings column names that supply its defaults. */
export const CATEGORY_DEFAULTS_MAP = {
  basic_bikini: {
    hoursField: 'defaultHoursBasicBikini',
    consumptionField: 'fabricConsumptionBikiniYards',
    minPriceField: 'minPriceBasicBikiniXcdCents'
  },
  basic_onepiece: {
    hoursField: 'defaultHoursBasicOnepiece',
    consumptionField: 'fabricConsumptionOnepieceYards',
    minPriceField: 'minPriceBasicOnepieceXcdCents'
  },
  complex_custom: {
    hoursField: 'defaultHoursComplexCustom',
    consumptionField: null,
    minPriceField: 'minPriceComplexCustomXcdCents'
  },
  other_custom: {
    hoursField: null,
    consumptionField: null,
    minPriceField: 'minPriceOtherCustomXcdCents'
  }
}
