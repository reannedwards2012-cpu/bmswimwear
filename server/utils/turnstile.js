/**
 * Server-side verification for Cloudflare Turnstile (public inquiry form —
 * server/api/inquiries.post.js).
 *
 * Secret key is read directly from `process.env.TURNSTILE_SECRET_KEY` —
 * same convention as GO2PAY_EMAIL/PASSWORD in server/utils/go2pay.js — and
 * is NEVER placed in runtimeConfig.public, returned to the client, or
 * logged (only HTTP status / generic error codes are ever logged — same
 * discipline as server/utils/go2pay.js). Only the site key (designed by
 * Cloudflare to be public) goes in runtimeConfig.public.turnstileSiteKey
 * (see nuxt.config.ts).
 *
 * Environment-aware fail posture:
 *   - PRODUCTION (anything that isn't explicitly `development`/`test` —
 *     i.e. "safe by default", not "unsafe unless we recognise the
 *     environment"): a missing OR invalid secret key REJECTS every
 *     submission (reason 'not-configured'). A forgotten env var in
 *     production can never silently disable this gate.
 *   - development/test ONLY: a missing secret key fails OPEN (skips
 *     verification) so local work isn't blocked before Turnstile keys are
 *     set up — but local development is expected to use Cloudflare's own
 *     published dummy test keys (see README / deployment notes) and
 *     exercise the real verification path, not rely on this fallback.
 * Once a secret key IS configured, a missing/invalid/expired token, a bad
 * secret key, or a failed verify request all REJECT (fail closed) in every
 * environment — this is the primary bot gate, not a soft check.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** True only when a secret key is actually configured. */
export function turnstileConfigured() {
  return !!process.env.TURNSTILE_SECRET_KEY
}

/**
 * Safe-by-default: only `development` and `test` are treated as non-production.
 * An unset or unrecognised NODE_ENV (e.g. a serverless runtime that doesn't
 * set it) is treated as production, never as a reason to fail open.
 */
function isDevOrTestEnv() {
  const env = process.env.NODE_ENV
  return env === 'development' || env === 'test'
}

/**
 * @param {string|undefined} token   the client-submitted Turnstile response
 * @param {string|null} remoteIp     optional, improves Cloudflare's own signal
 * @returns {Promise<{ ok: true, skipped?: true } | { ok: false, reason: string, codes?: string[] }>}
 */
export async function verifyTurnstileToken(token, remoteIp) {
  if (!turnstileConfigured()) {
    if (isDevOrTestEnv()) {
      console.warn('[turnstile] TURNSTILE_SECRET_KEY not set — verification skipped (dev/test only).')
      return { ok: true, skipped: true }
    }
    console.error('[turnstile] TURNSTILE_SECRET_KEY is not set — rejecting all inquiry submissions until it is configured.')
    return { ok: false, reason: 'not-configured' }
  }

  if (typeof token !== 'string' || !token.trim()) {
    return { ok: false, reason: 'missing-token' }
  }

  let res, json
  try {
    res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {})
      })
    })
    json = await res.json().catch(() => null)
  } catch (err) {
    console.error('[turnstile] verify request failed:', err?.message)
    return { ok: false, reason: 'verify-request-failed' }
  }

  if (!res.ok || !json) {
    console.error('[turnstile] verify request returned a bad response, HTTP', res?.status)
    return { ok: false, reason: 'verify-request-failed' }
  }

  if (json.success === true) return { ok: true }

  const codes = Array.isArray(json['error-codes']) ? json['error-codes'] : []

  // The SECRET key itself is wrong — a configuration problem, not a bad
  // token. Flagged loudly (never the key's value) since this silently
  // breaks the whole gate until someone fixes the env var, same severity
  // as "not configured" at all.
  if (codes.includes('invalid-input-secret') || codes.includes('missing-input-secret')) {
    console.error('[turnstile] TURNSTILE_SECRET_KEY was rejected by Cloudflare as invalid — rejecting this submission.')
    return { ok: false, reason: 'not-configured', codes }
  }

  if (codes.includes('timeout-or-duplicate')) return { ok: false, reason: 'expired-token', codes }
  if (codes.includes('missing-input-response')) return { ok: false, reason: 'missing-token', codes }
  return { ok: false, reason: 'invalid-token', codes }
}
