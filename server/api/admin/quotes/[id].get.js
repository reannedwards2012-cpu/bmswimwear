/**
 * GET /api/admin/quotes/:id
 *
 * Admin-only. Returns the full internal quote detail, including the
 * complete calculation snapshot (cost breakdown, margins, etc).
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { QUOTE_DETAIL_SELECT, mapQuoteDetail } from '../../../utils/quoteMappers.js'

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
    const { data: row, error } = await supabase.from('quotes').select(QUOTE_DETAIL_SELECT).eq('id', id).maybeSingle()

    if (error) {
      console.error('[admin/quotes] detail query failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load quote.' }
    }
    if (!row) {
      setResponseStatus(event, 404)
      return { error: 'Quote not found.' }
    }

    return { quote: mapQuoteDetail(row) }
  } catch (err) {
    console.error('[admin/quotes] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load quote.' }
  }
})
