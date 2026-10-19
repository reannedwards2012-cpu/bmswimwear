/**
 * GET /api/bikini-mix/event
 *
 * PUBLIC — no auth. The customer-safe subset of the event config (see
 * PUBLIC_EVENT_SELECT / mapPublicEvent in server/utils/bikiniMixMappers.js):
 * never capacity, never hold_minutes, never anything admin-only.
 *
 * This is the real, permanent data path for the customer-facing /bikini-mix
 * page — not a mock. While the migration hasn't been applied yet, the table
 * doesn't exist and this legitimately returns 503 `{ configured: false }`;
 * the frontend (composables/useBikiniMixEvent.js) falls back to clearly-
 * labeled mock data ONLY in that case, and switches to this real response
 * automatically the moment the migration is applied — no frontend code
 * changes needed then.
 */
import { supabaseAdmin } from '../../utils/supabaseAdmin.js'
import { PUBLIC_EVENT_SELECT, mapPublicEvent } from '../../utils/bikiniMixMappers.js'

export default defineEventHandler(async (event) => {
  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase.from('bikini_mix_event').select(PUBLIC_EVENT_SELECT).eq('id', 'default').maybeSingle()

    if (error) {
      // '42P01' = undefined_table (plain Postgres), 'PGRST205' = PostgREST's
      // own "table not in schema cache" — both mean the migration hasn't
      // been applied yet. Anything else is a real failure.
      const notConfigured = error.code === '42P01' || error.code === 'PGRST205'
      if (!notConfigured) console.error('[bikini-mix/event] query failed:', error.message)
      setResponseStatus(event, 503)
      return { configured: false }
    }
    if (!data) {
      setResponseStatus(event, 503)
      return { configured: false }
    }

    return { configured: true, event: mapPublicEvent(data) }
  } catch (err) {
    console.error('[bikini-mix/event] unexpected error:', err?.message)
    setResponseStatus(event, 503)
    return { configured: false }
  }
})
