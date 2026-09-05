/**
 * DELETE /api/admin/inquiries/:id
 *
 * Admin-only. Permanently deletes one inquiry (for spam / test entries).
 * 404 for an unknown id. Nothing cascades — inquiries are standalone.
 *
 * Isolated: writes only `public.inquiries`.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid inquiry id.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: existing, error: findError } = await supabase
      .from('inquiries')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (findError) {
      console.error('[admin/inquiries] delete lookup failed:', findError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not delete inquiry.' }
    }
    if (!existing) {
      setResponseStatus(event, 404)
      return { error: 'Inquiry not found.' }
    }

    const { error: deleteError } = await supabase.from('inquiries').delete().eq('id', id)
    if (deleteError) {
      console.error('[admin/inquiries] delete failed:', deleteError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not delete inquiry.' }
    }

    return { ok: true, id }
  } catch (err) {
    console.error('[admin/inquiries] unexpected delete error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not delete inquiry.' }
  }
})
