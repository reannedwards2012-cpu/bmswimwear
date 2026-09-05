/**
 * GET /api/admin/inquiries/:id
 *
 * Admin-only. Full inquiry detail including the private `admin_notes` and the
 * full message body. No status side effects — the status only ever changes
 * via the PATCH endpoint. 404 for an unknown id.
 *
 * Isolated: reads only `public.inquiries`.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { INQUIRY_DETAIL_SELECT, mapInquiryDetail } from '../../../utils/inquiryMappers.js'

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

    const { data, error } = await supabase
      .from('inquiries')
      .select(INQUIRY_DETAIL_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[admin/inquiries] detail query failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load inquiry.' }
    }
    if (!data) {
      setResponseStatus(event, 404)
      return { error: 'Inquiry not found.' }
    }

    return { inquiry: mapInquiryDetail(data) }
  } catch (err) {
    console.error('[admin/inquiries] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load inquiry.' }
  }
})
