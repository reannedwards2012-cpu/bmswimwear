/**
 * GET /api/admin/quotes/:id/image-urls
 *
 * Admin-only. Phase 2 follow-up — a lightweight refresh endpoint returning
 * ONLY this quote's inspiration images, freshly signed, as
 * { previewUrls: [...] } (same order/length as inspiration_image_urls).
 * Exists so the admin quote-detail page can silently renew expiring signed
 * URLs on a timer without re-fetching the quote itself, which would risk
 * disrupting the in-progress Quote Calculator form.
 *
 * Scoped exactly like GET /api/admin/quotes/:id: id-validated, admin-gated,
 * and every image resolved only from THIS quote's own just-fetched row —
 * never a client-supplied path/bucket.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { signQuoteInspirationImageUrls } from '../../../../utils/quoteInspirationImages.js'

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
    const { data, error } = await supabase.from('quotes').select('id, inspiration_image_urls').eq('id', id).maybeSingle()

    if (error) {
      console.error('[admin/quotes/image-urls] query failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not refresh images.' }
    }
    if (!data) {
      setResponseStatus(event, 404)
      return { error: 'Quote not found.' }
    }

    const previewUrls = await signQuoteInspirationImageUrls(supabase, data.inspiration_image_urls)
    return { previewUrls }
  } catch (err) {
    console.error('[admin/quotes/image-urls] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not refresh images.' }
  }
})
