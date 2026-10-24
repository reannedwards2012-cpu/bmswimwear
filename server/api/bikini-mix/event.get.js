/**
 * GET /api/bikini-mix/event
 *
 * PUBLIC — no auth. The customer-safe subset of the event config (see
 * PUBLIC_EVENT_SELECT / mapPublicEvent in server/utils/bikiniMixMappers.js):
 * never capacity, never hold_minutes, never anything admin-only.
 *
 * The real, permanent data path for the customer-facing /bikini-mix page —
 * there is no mock fallback on the frontend (composables/useBikiniMixEvent.js)
 * any more, so every non-2xx response here surfaces as a real error state
 * with a retry option, never silently substituted data. 503 is reserved
 * for "migration not applied" (table genuinely doesn't exist yet); any
 * other failure — RLS misconfiguration, connection error, etc. — is a
 * real 500, not folded into the same response.
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
      if (notConfigured) {
        setResponseStatus(event, 503)
        return { configured: false }
      }
      console.error('[bikini-mix/event] query failed:', error.message)
      setResponseStatus(event, 500)
      return { configured: false, error: 'Could not load event details.' }
    }
    if (!data) {
      setResponseStatus(event, 503)
      return { configured: false }
    }

    return { configured: true, event: mapPublicEvent(data) }
  } catch (err) {
    console.error('[bikini-mix/event] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { configured: false, error: 'Could not load event details.' }
  }
})
