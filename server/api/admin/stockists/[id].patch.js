/**
 * PATCH /api/admin/stockists/:id
 *
 * Admin-only. Partial update — any subset of stockist fields, including the
 * Active/Inactive (archive) toggle. Never touches inventory items/movements.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { validateStockistFields } from '../../../utils/stockistValidation.js'
import { STOCKIST_SELECT, mapStockist } from '../../../utils/stockistMappers.js'

const COLUMN_BY_FIELD = {
  name: 'name',
  location: 'location',
  contactName: 'contact_name',
  phone: 'phone',
  email: 'email',
  defaultCommissionBps: 'default_commission_bps',
  notes: 'notes',
  isActive: 'is_active'
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  const body = await readBody(event).catch(() => null)
  const { issues, fields } = validateStockistFields(body, { partial: true })
  if (issues.length) {
    setResponseStatus(event, 400)
    return { error: 'Invalid stockist details.', issues }
  }

  const patch = { updated_at: new Date().toISOString() }
  for (const [key, column] of Object.entries(COLUMN_BY_FIELD)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) patch[column] = fields[key]
  }
  if (Object.keys(patch).length === 1) {
    setResponseStatus(event, 400)
    return { error: 'No changes were provided.' }
  }

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase.from('stockists').update(patch).eq('id', id).select(STOCKIST_SELECT).maybeSingle()

    if (error) {
      console.error('[admin/stockists/:id] update failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update stockist.' }
    }
    if (!data) {
      setResponseStatus(event, 404)
      return { error: 'Stockist not found.' }
    }

    return { stockist: mapStockist(data) }
  } catch (err) {
    console.error('[admin/stockists/:id] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update stockist.' }
  }
})
