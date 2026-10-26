/**
 * GET /api/admin/quotes/settings
 *
 * Admin-only. Returns the single quote_pricing_settings row — the editable
 * defaults the New Quote calculator pre-fills (never a live reference any
 * saved quote depends on; see quotes.calculation).
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { PRICING_SETTINGS_SELECT, mapPricingSettings } from '../../../utils/quoteMappers.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('quote_pricing_settings')
      .select(PRICING_SETTINGS_SELECT)
      .eq('id', 'default')
      .maybeSingle()

    if (error) {
      console.error('[admin/quotes/settings] query failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load pricing settings.' }
    }
    if (!data) {
      setResponseStatus(event, 404)
      return { error: 'Pricing settings not found — has the migration been applied?' }
    }

    return { settings: mapPricingSettings(data) }
  } catch (err) {
    console.error('[admin/quotes/settings] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load pricing settings.' }
  }
})
