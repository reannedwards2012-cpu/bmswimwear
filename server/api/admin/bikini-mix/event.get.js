/**
 * GET /api/admin/bikini-mix/event
 *
 * Admin-only. The single Bikini Mix event config row (dates, venue,
 * capacity, packages/pricing, size guide, open/closed toggle).
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { EVENT_SELECT, mapEvent } from '../../../utils/bikiniMixMappers.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase.from('bikini_mix_event').select(EVENT_SELECT).eq('id', 'default').maybeSingle()

    if (error) {
      console.error('[admin/bikini-mix/event] load failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load event settings.' }
    }
    if (!data) {
      setResponseStatus(event, 404)
      return { error: 'Event configuration not found — has the migration been applied?' }
    }

    return { event: mapEvent(data) }
  } catch (err) {
    console.error('[admin/bikini-mix/event] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load event settings.' }
  }
})
