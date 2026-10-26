/**
 * DELETE /api/admin/quotes/inspiration-image
 *
 * Admin-only. Best-effort removal of one object from the
 * 'quote-inspiration-images' Storage bucket, given its public URL
 * (body: { url }). Always resolves { ok: true } — cleanup, not a
 * user-facing action with its own failure state.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { QUOTE_INSPIRATION_IMAGE_BUCKET, pathFromQuoteInspirationPublicUrl } from '../../../utils/quoteInspirationImages.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const path = pathFromQuoteInspirationPublicUrl(body?.url)

  if (path) {
    try {
      const { error } = await supabaseAdmin().storage.from(QUOTE_INSPIRATION_IMAGE_BUCKET).remove([path])
      if (error) console.error('[admin/quotes/inspiration-image] delete failed:', error.message)
    } catch (err) {
      console.error('[admin/quotes/inspiration-image] unexpected delete error:', err?.message)
    }
  }

  return { ok: true }
})
