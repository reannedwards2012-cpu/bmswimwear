/**
 * POST /api/admin/quotes/:id/duplicate
 *
 * Admin-only. Creates a new quote by copying an existing one's customer
 * info, description, category, calculation snapshot and price — reset to
 * 'draft' status with no admin/customer notes carried over (those are
 * specific to the original conversation, not reusable template content).
 * Useful for quoting a repeat customer or a near-identical design.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { QUOTE_DETAIL_SELECT, mapQuoteDetail } from '../../../../utils/quoteMappers.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid quote id.' }
  }

  try {
    const supabase = supabaseAdmin()
    const { data: source, error: readError } = await supabase
      .from('quotes')
      .select('customer_name, customer_email, customer_phone, description, category, inspiration_image_urls, calculation, final_price_xcd_cents')
      .eq('id', id)
      .maybeSingle()

    if (readError) {
      console.error('[admin/quotes] duplicate read failed:', readError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not duplicate quote.' }
    }
    if (!source) {
      setResponseStatus(event, 404)
      return { error: 'Quote not found.' }
    }

    const { data: row, error: insertError } = await supabase
      .from('quotes')
      .insert({
        status: 'draft',
        customer_name: source.customer_name,
        customer_email: source.customer_email,
        customer_phone: source.customer_phone,
        description: source.description,
        category: source.category,
        inspiration_image_urls: source.inspiration_image_urls ?? [],
        calculation: source.calculation,
        final_price_xcd_cents: source.final_price_xcd_cents,
        customer_notes: null,
        admin_notes: null
      })
      .select(QUOTE_DETAIL_SELECT)
      .single()

    if (insertError || !row) {
      console.error('[admin/quotes] duplicate insert failed:', insertError?.message)
      setResponseStatus(event, 500)
      return { error: 'Could not duplicate quote.' }
    }

    setResponseStatus(event, 201)
    return { quote: mapQuoteDetail(row) }
  } catch (err) {
    console.error('[admin/quotes] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not duplicate quote.' }
  }
})
