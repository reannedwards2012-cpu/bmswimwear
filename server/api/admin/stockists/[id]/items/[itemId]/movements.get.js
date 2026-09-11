/**
 * GET /api/admin/stockists/:id/items/:itemId/movements
 *
 * Admin-only. Full movement history for one inventory item, newest first —
 * powers the "why is remaining what it is" history view (section 8 of the
 * brief). Fetched on demand (not embedded in the stockist detail payload) so
 * that payload stays small as history grows.
 */
import { supabaseAdmin } from '../../../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../../../utils/authUser.js'
import { STOCKIST_MOVEMENT_SELECT, mapMovement } from '../../../../../../utils/stockistMappers.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const itemId = getRouterParam(event, 'itemId')

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('stockist_inventory_movements')
      .select(STOCKIST_MOVEMENT_SELECT)
      .eq('item_id', itemId)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[admin/.../movements] list failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load movement history.' }
    }

    return { movements: (data ?? []).map(mapMovement) }
  } catch (err) {
    console.error('[admin/.../movements] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load movement history.' }
  }
})
