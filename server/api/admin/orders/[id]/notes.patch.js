/**
 * PATCH /api/admin/orders/:id/notes
 *
 * Admin-only. Saves the private, internal `admin_notes` field on one order —
 * completely separate from the customer's own `notes` field. Never touches
 * status, paid_at, order_items, or any customer-facing data; never exposed
 * by any customer-facing endpoint.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { normalizeAdminNotes } from '../../../../utils/adminNotes.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid order id.' }
  }

  const body = await readBody(event).catch(() => null)
  const normalized = normalizeAdminNotes(body?.adminNotes)
  if (!normalized.ok) {
    setResponseStatus(event, 400)
    return { error: normalized.error }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: existing, error: findError } = await supabase.from('orders').select('id').eq('id', id).maybeSingle()

    if (findError) {
      console.error('[admin/orders] notes lookup failed:', findError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not save notes.' }
    }
    if (!existing) {
      setResponseStatus(event, 404)
      return { error: 'Order not found.' }
    }

    // Notes-only write. Deliberately touches nothing else — no status,
    // paid_at, order_items or customer fields.
    const { error: updateError } = await supabase
      .from('orders')
      .update({ admin_notes: normalized.value, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) {
      console.error('[admin/orders] notes update failed:', updateError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not save notes.' }
    }

    return { adminNotes: normalized.value }
  } catch (err) {
    console.error('[admin/orders] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not save notes.' }
  }
})
