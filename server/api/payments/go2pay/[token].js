/**
 * ANY non-POST /api/payments/go2pay/[token]  (GET, HEAD, OPTIONS, …)
 *
 * Endpoint-reachability probe only. Some providers issue a GET/HEAD against a
 * webhook URL before enabling callbacks. Returns 200 — no DB access, no
 * verification, no token disclosure. The real callback is handled by
 * `[token].post.js`, which takes precedence for POST.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler((event) => {
  const token = getRouterParam(event, 'token')
  console.log(
    '[go2pay callback] probe —',
    JSON.stringify({ method: event.method, tokenFormatValid: !!token && UUID_RE.test(token) })
  )
  return { ok: true }
})
