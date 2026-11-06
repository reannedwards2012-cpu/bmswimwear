/**
 * Generic, scope-tagged abuse throttle shared by the three public
 * checkout/booking endpoints (server/api/checkout.post.js,
 * server/api/bikini-mix/checkout.post.js, server/api/checkout/quote.post.js).
 *
 * Deliberately a SEPARATE table/module from server/utils/inquiryRateLimit.js
 * — never touches `inquiry_rate_hits` or the Inquiries rate limits, so this
 * work can't regress that already-shipped feature. See
 * supabase/migrations/20261106000000_checkout_abuse_protection.sql.
 *
 * Callers import `resolveClientIp`/`ipHash` directly from
 * server/utils/inquiryRateLimit.js (same privacy posture: hashed IP only,
 * via the same INQUIRY_HASH_SECRET, never a raw IP, never a raw
 * user-agent) — this module does NOT re-export them, so every server file
 * has exactly one place importing each name (Nitro's server/utils
 * auto-import otherwise warns about — and non-deterministically resolves —
 * a duplicate export).
 *
 * Fails OPEN on every error path, including a genuine database outage —
 * checkout/booking availability deliberately wins over this SECONDARY
 * defense: the underlying checkout logic has its own robustness
 * (idempotency keys, Go2Pay's independent verification), and Turnstile —
 * the primary bot defense — doesn't depend on Supabase at all, so briefly
 * losing this counter during a real outage is a reasonable trade, not a
 * real exposure.
 *
 * What DOES change is the logging, per the explicit review requirement to
 * never silently ignore an unexpected error: every failure is classified
 * via the shared isMigrationNotAppliedError() (server/utils/
 * bikiniMixMigrationGuard.js, already proven for the Swimsuit Mixer
 * endpoints) into exactly two buckets —
 *   - "migration not applied yet" (missing table/column) → console.warn,
 *     expected right up until the Phase 1 migration is deployed.
 *   - anything else (a real outage, a permissions problem, a genuine bug)
 *     → console.error with an "UNEXPECTED" marker, so it reads as
 *     distinctly actionable in the logs instead of blending into the
 *     expected pre-migration noise above. Never logs the key hash, the
 *     caller's IP, or any other request detail — only the Postgres/
 *     PostgREST error code and message, same as every other error log in
 *     this codebase.
 */
import { isMigrationNotAppliedError } from './bikiniMixMigrationGuard.js'

const TABLE = 'checkout_rate_hits'
const RETENTION_HOURS = 24

function logRateLimitError(context, error) {
  if (isMigrationNotAppliedError(error)) {
    console.warn(`[checkout-rate-limit] ${context} — migration not applied yet (expected pre-deploy):`, error.code)
  } else {
    console.error(`[checkout-rate-limit] UNEXPECTED ${context} — rate limiting degraded, investigate:`, error.code, error.message)
  }
}

/**
 * @param supabase  service-role client
 * @param {{ scope: string, keyHash: string|null, windowMinutes: number, maxPerWindow: number }} args
 * @returns {Promise<{ ok: true } | { ok: false, retryAfterSeconds: number }>}
 */
export async function checkRateLimit(supabase, { scope, keyHash, windowMinutes, maxPerWindow }) {
  if (!keyHash) return { ok: true } // IP throttling not configured/resolvable — fail open

  const now = Date.now()
  const windowStart = new Date(now - windowMinutes * 60_000).toISOString()

  // Opportunistic prune — bounded, index-supported, never fatal.
  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .lt('created_at', new Date(now - RETENTION_HOURS * 3_600_000).toISOString())
    if (error) logRateLimitError('prune failed', error)
  } catch (err) {
    console.error('[checkout-rate-limit] UNEXPECTED prune threw — rate limiting degraded, investigate:', err?.message)
  }

  const { count, error } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('scope', scope)
    .eq('key_hash', keyHash)
    .gte('created_at', windowStart)

  if (error) {
    logRateLimitError('lookup failed', error)
    return { ok: true } // fail open — see file header
  }
  if ((count ?? 0) >= maxPerWindow) {
    return { ok: false, retryAfterSeconds: windowMinutes * 60 }
  }
  return { ok: true }
}

/** Record one hit for this scope+key. Best-effort, no-op when keyHash is null. */
export async function recordRateHit(supabase, { scope, keyHash }) {
  if (!keyHash) return
  const { error } = await supabase.from(TABLE).insert({ scope, key_hash: keyHash })
  if (error) logRateLimitError('record failed', error)
}
