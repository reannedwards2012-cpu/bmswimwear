/**
 * POST /api/admin/fabrics/bulk-status     body: { ids: string[], isActive: boolean }
 *
 * Admin-only. Bulk toggle of `fabrics.is_active` only — the safe,
 * reversible alternative to deletion (see bulk-delete.post.js). Never
 * touches product_fabrics links, status, quantity, or anything else.
 *
 * Capped at MAX_BULK_IDS per call. Every id must be a well-formed UUID.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MAX_BULK_IDS = 100

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const rawIds = Array.isArray(body?.ids) ? body.ids : null
  const isActive = body?.isActive

  if (typeof isActive !== 'boolean') {
    setResponseStatus(event, 400)
    return { error: 'Body must include { isActive: true | false }.' }
  }
  if (!rawIds || rawIds.length === 0) {
    setResponseStatus(event, 400)
    return { error: 'Provide at least one fabric id.' }
  }
  if (rawIds.length > MAX_BULK_IDS) {
    setResponseStatus(event, 400)
    return { error: `You can update at most ${MAX_BULK_IDS} fabrics at a time.` }
  }
  const ids = [...new Set(rawIds)]
  if (ids.some((id) => typeof id !== 'string' || !UUID_RE.test(id))) {
    setResponseStatus(event, 400)
    return { error: 'One or more fabric ids are invalid.' }
  }

  try {
    const supabase = supabaseAdmin()
    const { data: updated, error } = await supabase.from('fabrics').update({ is_active: isActive }).in('id', ids).select('id')

    if (error) {
      console.error('[admin/fabrics] bulk-status update failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update the selected fabrics.' }
    }

    return { ok: true, updatedCount: updated?.length ?? 0, requestedCount: ids.length }
  } catch (err) {
    console.error('[admin/fabrics] unexpected bulk-status error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update the selected fabrics.' }
  }
})
