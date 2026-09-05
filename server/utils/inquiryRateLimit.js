/**
 * Abuse throttle for the public inquiry endpoint (server/api/inquiries.post.js).
 *
 * Privacy: no raw IP address and no user-agent is ever stored. IP throttling
 * persists only an HMAC-SHA256 of the caller's IP, keyed by a DEDICATED
 * server-only secret (`INQUIRY_HASH_SECRET`). There is NO fallback to another
 * application credential — if that env var is absent, IP throttling is simply
 * skipped (fails safe/open) and the honeypot + email throttle still apply.
 *
 * Serverless-safe: all state lives in Postgres (`public.inquiry_rate_hits`,
 * plus the `inquiries` table itself for the email signal), never in process
 * memory. The endpoint opportunistically prunes rows older than the retention
 * window on each call.
 *
 * Isolated: touches only the two inquiry tables. Nothing here is reachable
 * from Orders / Go2Pay / Products / Fabrics / Checkout / Newsletter.
 */
import { createHmac } from 'node:crypto'

export const WINDOW_MINUTES = 10
// Per-email is the "this address is spamming" signal — kept tight.
export const MAX_EMAIL_PER_WINDOW = 3
// Per-IP is a flood backstop only, and is deliberately looser: Caribbean
// mobile carriers put many real users behind one CGNAT address, and offices /
// cafés share an IP too — a tight IP cap would false-positive on them. The
// honeypot + the per-email cap are the real anti-spam gates.
export const MAX_IP_PER_WINDOW = 10
export const RETENTION_HOURS = 24
const RATE_TABLE = 'inquiry_rate_hits'

/**
 * Resolve the caller's IP. On Netlify the trustworthy header is
 * `x-nf-client-connection-ip`; `x-forwarded-for` (first hop) and h3's
 * `getRequestIP` are fallbacks. Returns null when nothing is available
 * (e.g. local dev) — the caller then skips IP throttling.
 */
export function resolveClientIp(event) {
  const nf = getRequestHeader(event, 'x-nf-client-connection-ip')
  if (nf && nf.trim()) return nf.trim()

  const xff = getRequestHeader(event, 'x-forwarded-for')
  if (xff && xff.trim()) return xff.split(',')[0].trim()

  try {
    const ip = getRequestIP(event, { xForwardedFor: true })
    return ip ? String(ip).trim() : null
  } catch {
    return null
  }
}

/**
 * HMAC of `ip` with the dedicated secret. Returns null (⇒ IP throttling
 * disabled) when `INQUIRY_HASH_SECRET` is unset or there is no IP.
 * NEVER substitutes another credential.
 */
export function ipHash(ip) {
  const secret = process.env.INQUIRY_HASH_SECRET
  if (!secret || !ip) return null
  return createHmac('sha256', secret).update(`ip:${ip}`).digest('hex')
}

/** True once at startup-ish visibility: is IP throttling configured at all? */
export const ipThrottleConfigured = () => !!process.env.INQUIRY_HASH_SECRET

/**
 * Decide whether this submission may proceed.
 *
 * @param supabase  service-role client
 * @param {{ ipHashValue: string|null, email: string }} args
 * @returns {Promise<{ ok: true } | { ok: false, retryAfterSeconds: number }>}
 */
export async function checkInquiryRateLimit(supabase, { ipHashValue, email }) {
  const now = Date.now()
  const windowStart = new Date(now - WINDOW_MINUTES * 60_000).toISOString()

  // Opportunistic prune — bounded work, index-supported, never fatal.
  try {
    await supabase
      .from(RATE_TABLE)
      .delete()
      .lt('created_at', new Date(now - RETENTION_HOURS * 3_600_000).toISOString())
  } catch (err) {
    console.error('[inquiries] rate-hit prune skipped:', err?.message)
  }

  // ── IP signal (only when configured + resolvable) ──
  if (ipHashValue) {
    const { count, error } = await supabase
      .from(RATE_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('key_hash', ipHashValue)
      .gte('created_at', windowStart)
    if (error) {
      console.error('[inquiries] rate lookup (ip) failed:', error.message)
      // fail open on infra error — honeypot + email signal still gate
    } else if ((count ?? 0) >= MAX_IP_PER_WINDOW) {
      return { ok: false, retryAfterSeconds: WINDOW_MINUTES * 60 }
    }
  }

  // ── Email signal (no extra storage — counts recent inquiries) ──
  if (email) {
    const { count, error } = await supabase
      .from('inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .gte('created_at', windowStart)
    if (error) {
      console.error('[inquiries] rate lookup (email) failed:', error.message)
    } else if ((count ?? 0) >= MAX_EMAIL_PER_WINDOW) {
      return { ok: false, retryAfterSeconds: WINDOW_MINUTES * 60 }
    }
  }

  return { ok: true }
}

/**
 * Record one accepted submission for the IP signal. Best-effort — a failure
 * here is logged, never fatal (the inquiry is already stored). No-op when IP
 * throttling isn't configured/resolvable.
 */
export async function recordInquiryRateHit(supabase, ipHashValue) {
  if (!ipHashValue) return
  const { error } = await supabase.from(RATE_TABLE).insert({ key_hash: ipHashValue })
  if (error) console.error('[inquiries] rate-hit insert failed:', error.message)
}
