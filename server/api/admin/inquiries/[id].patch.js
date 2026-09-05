/**
 * PATCH /api/admin/inquiries/:id
 *
 * Admin-only. Partial update of `status` and/or `admin_notes`. Statuses move
 * freely between new / open / responded / closed (not a safety-critical
 * workflow). Touches nothing else. 404 for an unknown id.
 *
 * `admin_notes` is private — written here, returned only by the admin detail
 * mapper, never by any public route.
 *
 * Isolated: writes only `public.inquiries`.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { normalizeInquiryStatus, normalizeInquiryNotes } from '../../../utils/inquiryValidation.js'
import { INQUIRY_DETAIL_SELECT, mapInquiryDetail } from '../../../utils/inquiryMappers.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid inquiry id.' }
  }

  const body = await readBody(event).catch(() => null)

  const status = normalizeInquiryStatus(body?.status)
  if (!status.ok) {
    setResponseStatus(event, 400)
    return { error: status.error }
  }
  const notes = normalizeInquiryNotes(body?.adminNotes)
  if (!notes.ok) {
    setResponseStatus(event, 400)
    return { error: notes.error }
  }

  const patch = { updated_at: new Date().toISOString() }
  if (status.value !== undefined) patch.status = status.value
  if (notes.value !== undefined) patch.admin_notes = notes.value

  if (Object.keys(patch).length === 1) {
    setResponseStatus(event, 400)
    return { error: 'Nothing to update — send a status and/or adminNotes.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: existing, error: findError } = await supabase
      .from('inquiries')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (findError) {
      console.error('[admin/inquiries] patch lookup failed:', findError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update inquiry.' }
    }
    if (!existing) {
      setResponseStatus(event, 404)
      return { error: 'Inquiry not found.' }
    }

    const { error: updateError } = await supabase.from('inquiries').update(patch).eq('id', id)
    if (updateError) {
      console.error('[admin/inquiries] update failed:', updateError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update inquiry.' }
    }

    const { data: full, error: reloadError } = await supabase
      .from('inquiries')
      .select(INQUIRY_DETAIL_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (reloadError || !full) {
      console.error('[admin/inquiries] post-update reload failed:', reloadError?.message)
      setResponseStatus(event, 500)
      return { error: 'Inquiry updated, but could not be re-read.' }
    }

    return { inquiry: mapInquiryDetail(full) }
  } catch (err) {
    console.error('[admin/inquiries] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update inquiry.' }
  }
})
