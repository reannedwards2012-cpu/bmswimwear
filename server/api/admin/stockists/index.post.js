/**
 * POST /api/admin/stockists
 *
 * Admin-only. Creates a stockist. All fields validated server-side
 * (server/utils/stockistValidation.js).
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { validateStockistFields } from '../../../utils/stockistValidation.js'
import { STOCKIST_SELECT, mapStockist } from '../../../utils/stockistMappers.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const { issues, fields } = validateStockistFields(body, { partial: false })
  if (issues.length) {
    setResponseStatus(event, 400)
    return { error: 'Invalid stockist details.', issues }
  }

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('stockists')
      .insert({
        name: fields.name,
        location: fields.location ?? null,
        contact_name: fields.contactName ?? null,
        phone: fields.phone ?? null,
        email: fields.email ?? null,
        default_commission_bps: fields.defaultCommissionBps ?? null,
        notes: fields.notes ?? null,
        is_active: fields.isActive
      })
      .select(STOCKIST_SELECT)
      .single()

    if (error || !data) {
      console.error('[admin/stockists] insert failed:', error?.message)
      setResponseStatus(event, 500)
      return { error: 'Could not create stockist.' }
    }

    setResponseStatus(event, 201)
    return { stockist: mapStockist(data) }
  } catch (err) {
    console.error('[admin/stockists] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not create stockist.' }
  }
})
