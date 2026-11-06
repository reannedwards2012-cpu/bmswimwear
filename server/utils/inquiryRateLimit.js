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
 * Resolve the caller's IP for abuse-throttling purposes — used by every
 * rate limiter in this codebase (Inquiries here, Checkout/Bikini-Mix in
 * server/utils/checkoutRateLimit.js).
 *
 * `x-nf-client-connection-ip` is the ONLY header trusted: Netlify's own
 * support staff describe it as the one header they guarantee reflects the
 * real connecting client IP ("we make no guarantees on anything except
 * X-Nf-Client-Connection-Ip"), and confirm `X-Forwarded-For` is explicitly
 * NOT a header Netlify supports or sanitizes — a client can set it
 * directly, so trusting it for abuse protection would let that protection
 * be trivially bypassed by sending a different fake value on every
 * request. Deliberately NOT read here, even as a fallback.
 *
 * Fallback when that header is absent (expected in local dev — `nuxt dev`
 * never runs behind Netlify's edge — and logged as a warning anywhere
 * else, since on the deployed site it should never be missing): the raw
 * socket peer address only (`getRequestIP` with no `xForwardedFor`
 * option). That value comes from the actual TCP connection, not from any
 * header, so a request can never override it — safe, just not meaningful
 * behind a reverse proxy (which is fine, since production always has the
 * Netlify header). Returns null only if even that fails (e.g. no
 * underlying connection object in some test harness) — callers already
 * treat null as "skip IP throttling," so this still fails open.
 */
export function resolveClientIp(event) {
  const nf = getRequestHeader(event, 'x-nf-client-connection-ip')
  if (nf && nf.trim()) return nf.trim()

  console.warn('[ip-resolve] x-nf-client-connection-ip missing — falling back to the raw socket address (expected in local dev only; investigate if seen in production)')

  try {
    const ip = getRequestIP(event)
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
