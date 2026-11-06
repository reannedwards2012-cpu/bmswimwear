/**
 * POST /api/admin/inquiries/bulk-delete
 *
 * Admin-only. Permanently deletes a batch of inquiries by id (spam / test
 * cleanup from the admin inquiries list's bulk-select UI). Only ever
 * operates on an explicit, client-supplied list of ids — there is
 * deliberately no filter-based ("delete everything matching X") variant,
 * so the blast radius is always exactly what the admin visually selected.
 *
 * Body: { ids: string[] }  — every id must be a well-formed UUID; the whole
 * request is rejected (400) if any one isn't, rather than silently skipping
 * bad entries. Capped at MAX_IDS per call so a malformed/huge payload can
 * never remove more than that in one request.
 *
 * Nothing cascades — inquiries are standalone, same as the single-delete
 * endpoint (server/api/admin/inquiries/[id].delete.js), which this leaves
 * untouched for single-row deletes.
 *
 * Isolated: writes only `public.inquiries`.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MAX_BULK_DELETE_IDS = 100

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const rawIds = Array.isArray(body?.ids) ? body.ids : null

  if (!rawIds || rawIds.length === 0) {
    setResponseStatus(event, 400)
    return { error: 'Provide at least one inquiry id to delete.' }
  }

  // De-dupe, but keep validating the ORIGINAL list length against the cap —
  // a client sending 500 duplicate ids is still a malformed/oversized request.
  if (rawIds.length > MAX_BULK_DELETE_IDS) {
    setResponseStatus(event, 400)
    return { error: `You can delete at most ${MAX_BULK_DELETE_IDS} inquiries at a time.` }
  }

  const ids = [...new Set(rawIds)]
  const invalid = ids.find((id) => typeof id !== 'string' || !UUID_RE.test(id))
  if (invalid !== undefined) {
    setResponseStatus(event, 400)
    return { error: 'One or more inquiry ids are invalid.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: deleted, error: deleteError } = await supabase.from('inquiries').delete().in('id', ids).select('id')

    if (deleteError) {
      console.error('[admin/inquiries] bulk delete failed:', deleteError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not delete the selected inquiries.' }
    }

    return { ok: true, deletedCount: deleted?.length ?? 0, requestedCount: ids.length }
  } catch (err) {
    console.error('[admin/inquiries] unexpected bulk delete error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not delete the selected inquiries.' }
  }
})
