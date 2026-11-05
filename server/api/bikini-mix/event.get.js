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
import { isMigrationNotAppliedError } from '../../utils/bikiniMixMigrationGuard.js'

export default defineEventHandler(async (event) => {
  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase.from('bikini_mix_event').select(PUBLIC_EVENT_SELECT).eq('id', 'default').maybeSingle()

    if (error) {
      // Covers both "table missing" (migration never run at all) and
      // "column missing" (bikini_mix_event exists from an earlier
      // migration, but regular_price_xcd_cents/ticket_inclusions/etc. —
      // added later — don't yet) — both mean "migration not applied".
      if (isMigrationNotAppliedError(error)) {
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

    // Display-only indicator, computed with the SAME predicate
    // claim_bikini_mix_booking() uses under its lock — this read is
    // deliberately unlocked (a plain count, not `for update`), so it can
    // never be more than an optimistic hint: the only authoritative
    // decision happens inside the RPC at checkout time. Overall event
    // capacity is still never exposed (per the brief), but the early-bird
    // slot count — and now how many of those slots remain — is deliberately
    // public, for "Only N Early Bird Spots Left" copy.
    let earlyBirdAvailable = false
    let earlyBirdRemaining = data.early_bird_slots ?? 0
    const { count, error: countError } = await supabase
      .from('bikini_mix_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('is_test', false)
      .or(`and(status.eq.confirmed,early_bird_applied.eq.true),and(status.eq.pending_payment,early_bird_quoted.eq.true,hold_expires_at.gt.${new Date().toISOString()})`)

    if (!countError) {
      earlyBirdRemaining = Math.max(0, (data.early_bird_slots ?? 3) - (count ?? 0))
      earlyBirdAvailable = earlyBirdRemaining > 0
    } else {
      console.error('[bikini-mix/event] early-bird count query failed:', countError.message)
    }

    return { configured: true, event: mapPublicEvent(data, earlyBirdAvailable, earlyBirdRemaining) }
  } catch (err) {
    console.error('[bikini-mix/event] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { configured: false, error: 'Could not load event details.' }
  }
})
