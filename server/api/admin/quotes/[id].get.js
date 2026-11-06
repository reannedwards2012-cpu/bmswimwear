/**
 * GET /api/admin/quotes/:id
 *
 * Admin-only. Returns the full internal quote detail, including the
 * complete calculation snapshot (cost breakdown, margins, etc).
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { QUOTE_DETAIL_SELECT, mapQuoteDetail } from '../../../utils/quoteMappers.js'
import { signQuoteInspirationImageUrls } from '../../../utils/quoteInspirationImages.js'

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

    const quote = mapQuoteDetail(row)

    // Phase 2: 'quote-inspiration-images' is a private bucket now. Keep
    // `inspirationImageUrls` as the unchanged, canonical (stored-shape)
    // values — the Quote Calculator form re-submits them verbatim on save,
    // so substituting signed URLs there would corrupt the stored data.
    // `inspirationImagePreviewUrls` is a parallel, display-only array
    // (same order/length) for actually rendering the <img> tags. Both are
    // derived from this one already-admin-gated, id-scoped quote row.
    quote.inspirationImagePreviewUrls = await signQuoteInspirationImageUrls(supabase, quote.inspirationImageUrls)

    return { quote }
  } catch (err) {
    console.error('[admin/quotes] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load quote.' }
  }
})
