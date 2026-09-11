/**
 * DELETE /api/admin/stockists/:id
 *
 * Admin-only. Permanently deletes a stockist ONLY when it has zero inventory
 * items — i.e. nothing to lose. A stockist with any inventory history must be
 * set Inactive instead (PATCH { isActive: false }); see section 14 of the
 * brief ("do not casually hard-delete stockists or inventory history").
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')

  try {
    const supabase = supabaseAdmin()

    const { count, error: countError } = await supabase
      .from('stockist_inventory_items')
      .select('id', { count: 'exact', head: true })
      .eq('stockist_id', id)

    if (countError) {
      console.error('[admin/stockists/:id] item count failed:', countError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not delete stockist.' }
    }
    if (count > 0) {
      setResponseStatus(event, 409)
      return { error: 'This stockist has inventory history and can’t be deleted. Set it to Inactive instead.' }
    }

    const { error, count: deletedCount } = await supabase.from('stockists').delete({ count: 'exact' }).eq('id', id)
    if (error) {
      console.error('[admin/stockists/:id] delete failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not delete stockist.' }
    }
    if (!deletedCount) {
      setResponseStatus(event, 404)
      return { error: 'Stockist not found.' }
    }

    return { ok: true }
  } catch (err) {
    console.error('[admin/stockists/:id] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not delete stockist.' }
  }
})
