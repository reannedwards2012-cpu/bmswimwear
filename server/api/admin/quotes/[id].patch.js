/**
 * PATCH /api/admin/quotes/:id
 *
 * Admin-only. Updates a quote's top-level fields (customer info, status,
 * description, category, notes, inspiration images) and/or recomputes its
 * pricing when a new `calculatorInput` is sent — same
 * never-trust-the-client-total rule as index.post.js. Sending only
 * top-level fields (e.g. just a status change) leaves the stored
 * `calculation`/`final_price_xcd_cents` untouched.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { validateQuoteFields, validateCalculatorInput } from '../../../utils/quoteValidation.js'
import { QUOTE_DETAIL_SELECT, mapQuoteDetail } from '../../../utils/quoteMappers.js'
import { calculateQuote } from '../../../../utils/quoteCalculator.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const FIELD_MAP = {
  customerName: 'customer_name',
  customerEmail: 'customer_email',
  customerPhone: 'customer_phone',
  description: 'description',
  category: 'category',
  status: 'status',
  customerNotes: 'customer_notes',
  adminNotes: 'admin_notes',
  inspirationImageUrls: 'inspiration_image_urls'
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid quote id.' }
  }

  const body = await readBody(event).catch(() => null)
  const { issues: fieldIssues, fields } = validateQuoteFields(body, { partial: true })

  const updates = {}
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) updates[column] = fields[key]
  }

  let calcIssues = []
  if (body && typeof body === 'object' && body.calculatorInput) {
    const result = validateCalculatorInput(body.calculatorInput)
    calcIssues = result.issues
    if (!calcIssues.length) {
      const { fabricId, ...calculatorArgs } = result.input
      try {
        if (fabricId) {
          const { data: fabric } = await supabaseAdmin()
            .from('fabrics')
            .select('unit_cost_xcd_cents')
            .eq('id', fabricId)
            .maybeSingle()
          if (fabric?.unit_cost_xcd_cents != null) calculatorArgs.fabricCostPerYardXcdCents = fabric.unit_cost_xcd_cents
        }
      } catch (err) {
        console.error('[admin/quotes] fabric cost lookup failed:', err?.message)
      }
      const calculation = calculateQuote(calculatorArgs)
      updates.calculation = calculation
      updates.final_price_xcd_cents = calculation.outputs.finalPriceXcdCents
    }
  }

  const allIssues = [...fieldIssues, ...calcIssues]
  if (allIssues.length) {
    setResponseStatus(event, 400)
    return { error: 'Invalid quote details.', issues: allIssues }
  }

  if (!Object.keys(updates).length) {
    setResponseStatus(event, 400)
    return { error: 'No changes were provided.' }
  }

  updates.updated_at = new Date().toISOString()

  try {
    const supabase = supabaseAdmin()
    const { data: row, error } = await supabase
      .from('quotes')
      .update(updates)
      .eq('id', id)
      .select(QUOTE_DETAIL_SELECT)
      .maybeSingle()

    if (error) {
      console.error('[admin/quotes] update failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update quote.' }
    }
    if (!row) {
      setResponseStatus(event, 404)
      return { error: 'Quote not found.' }
    }

    return { quote: mapQuoteDetail(row) }
  } catch (err) {
    console.error('[admin/quotes] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update quote.' }
  }
})
