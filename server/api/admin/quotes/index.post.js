/**
 * POST /api/admin/quotes
 *
 * Admin-only. Creates a custom quote. The admin-submitted calculator inputs
 * are validated, then run through the SAME pure calculateQuote() function
 * used for the live client-side preview — the server never simply persists
 * a client-submitted price/profit/margin, it always recomputes them from
 * the validated inputs before saving (the full {inputs, outputs} snapshot
 * is stored in `calculation`, so this quote's numbers stay accurate even
 * after quote_pricing_settings' defaults change later).
 *
 * When `calculatorInput.fabricId` references a real fabric with a recorded
 * `unit_cost_xcd_cents`, that recorded cost OVERRIDES whatever
 * fabricCostPerYardXcdCents the client sent for that fabric — the server is
 * authoritative for a linked fabric's cost. A manually-entered/custom
 * fabric (fabricId left null) keeps the client-provided rate untouched.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { validateQuoteFields, validateCalculatorInput } from '../../../utils/quoteValidation.js'
import { QUOTE_DETAIL_SELECT, mapQuoteDetail } from '../../../utils/quoteMappers.js'
import { calculateQuote } from '../../../../utils/quoteCalculator.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const { issues: fieldIssues, fields } = validateQuoteFields(body, { partial: false })
  const { issues: calcIssues, input: calcInput } = validateCalculatorInput(body?.calculatorInput)

  const allIssues = [...fieldIssues, ...calcIssues]
  if (allIssues.length) {
    setResponseStatus(event, 400)
    return { error: 'Invalid quote details.', issues: allIssues }
  }

  try {
    const supabase = supabaseAdmin()

    if (calcInput.fabricId) {
      const { data: fabric } = await supabase
        .from('fabrics')
        .select('unit_cost_xcd_cents')
        .eq('id', calcInput.fabricId)
        .maybeSingle()
      if (fabric?.unit_cost_xcd_cents != null) {
        calcInput.fabricCostPerYardXcdCents = fabric.unit_cost_xcd_cents
      }
    }

    const { fabricId, ...calculatorArgs } = calcInput
    const calculation = calculateQuote(calculatorArgs)

    const { data: row, error: insertError } = await supabase
      .from('quotes')
      .insert({
        status: fields.status,
        customer_name: fields.customerName,
        customer_email: fields.customerEmail ?? null,
        customer_phone: fields.customerPhone ?? null,
        description: fields.description ?? null,
        category: fields.category,
        inspiration_image_urls: fields.inspirationImageUrls ?? [],
        calculation,
        final_price_xcd_cents: calculation.outputs.finalPriceXcdCents,
        customer_notes: fields.customerNotes ?? null,
        admin_notes: fields.adminNotes ?? null
      })
      .select(QUOTE_DETAIL_SELECT)
      .single()

    if (insertError || !row) {
      console.error('[admin/quotes] insert failed:', insertError?.message)
      setResponseStatus(event, 500)
      return { error: 'Could not create quote.' }
    }

    setResponseStatus(event, 201)
    return { quote: mapQuoteDetail(row) }
  } catch (err) {
    console.error('[admin/quotes] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not create quote.' }
  }
})
