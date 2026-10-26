/**
 * PATCH /api/admin/quotes/settings
 *
 * Admin-only. Updates any subset of quote_pricing_settings' editable
 * defaults. Mirrors server/api/admin/bikini-mix/event.patch.js's pattern.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { validateSettingsFields } from '../../../utils/quoteValidation.js'
import { PRICING_SETTINGS_SELECT, mapPricingSettings } from '../../../utils/quoteMappers.js'

const COLUMN_BY_FIELD = {
  labourRateXcdCents: 'labour_rate_xcd_cents',
  defaultHoursBasicBikini: 'default_hours_basic_bikini',
  defaultHoursBasicOnepiece: 'default_hours_basic_onepiece',
  defaultHoursComplexCustom: 'default_hours_complex_custom',
  fabricCostSolidXcdCents: 'fabric_cost_solid_xcd_cents',
  fabricCostPrintedXcdCents: 'fabric_cost_printed_xcd_cents',
  fabricConsumptionBikiniYards: 'fabric_consumption_bikini_yards',
  fabricConsumptionOnepieceYards: 'fabric_consumption_onepiece_yards',
  packagingXcdCents: 'packaging_xcd_cents',
  consumablesXcdCents: 'consumables_xcd_cents',
  electricityMonthlyXcdCents: 'electricity_monthly_xcd_cents',
  machineMaintenanceMonthlyXcdCents: 'machine_maintenance_monthly_xcd_cents',
  expectedMonthlyVolume: 'expected_monthly_volume',
  designFeeMinorXcdCents: 'design_fee_minor_xcd_cents',
  designFeeNewXcdCents: 'design_fee_new_xcd_cents',
  designFeeComplexXcdCents: 'design_fee_complex_xcd_cents',
  fittingAllowanceXcdCents: 'fitting_allowance_xcd_cents',
  targetMarginPercent: 'target_margin_percent',
  depositPercent: 'deposit_percent',
  minPriceBasicBikiniXcdCents: 'min_price_basic_bikini_xcd_cents',
  minPriceBasicOnepieceXcdCents: 'min_price_basic_onepiece_xcd_cents',
  minPriceComplexCustomXcdCents: 'min_price_complex_custom_xcd_cents',
  minPriceOtherCustomXcdCents: 'min_price_other_custom_xcd_cents'
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const { issues, fields } = validateSettingsFields(body, { partial: true })
  if (issues.length) {
    setResponseStatus(event, 400)
    return { error: 'Invalid pricing settings.', issues }
  }

  const patch = { updated_at: new Date().toISOString() }
  for (const [field, column] of Object.entries(COLUMN_BY_FIELD)) {
    if (Object.prototype.hasOwnProperty.call(fields, field)) patch[column] = fields[field]
  }

  if (Object.keys(patch).length === 1) {
    setResponseStatus(event, 400)
    return { error: 'No changes were provided.' }
  }

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('quote_pricing_settings')
      .update(patch)
      .eq('id', 'default')
      .select(PRICING_SETTINGS_SELECT)
      .maybeSingle()

    if (error) {
      console.error('[admin/quotes/settings] update failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update pricing settings.' }
    }
    if (!data) {
      setResponseStatus(event, 404)
      return { error: 'Pricing settings not found.' }
    }

    return { settings: mapPricingSettings(data) }
  } catch (err) {
    console.error('[admin/quotes/settings] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update pricing settings.' }
  }
})
