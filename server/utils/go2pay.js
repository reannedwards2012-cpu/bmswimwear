/**
 * Server-only Go2Pay REST client.
 *
 * Base: https://go2pay.gd/api/v1
 * Auth: POST /auth/login with GO2PAY_EMAIL / GO2PAY_PASSWORD -> data.access_token (JWT).
 *
 * The access token is cached in server memory and reused until shortly before
 * its expiry (data.expires_in, ~3600s). On a 401 we re-authenticate once. No
 * refresh-token persistence in this version.
 *
 * Credentials and tokens are NEVER logged, returned to the client, or placed in
 * runtime config. Only HTTP status codes and generic messages are logged.
 */

const BASE_URL = 'https://go2pay.gd/api/v1'
const EXPIRY_SKEW_MS = 60_000

let tokenCache = { token: null, expiresAt: 0 }

async function login() {
  const email = process.env.GO2PAY_EMAIL
  const password = process.env.GO2PAY_PASSWORD
  if (!email || !password) {
    throw new Error('Go2Pay credentials not configured (GO2PAY_EMAIL / GO2PAY_PASSWORD)')
  }

  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ email, password })
  })
  const json = await res.json().catch(() => null)

  if (!res.ok || !json?.data?.access_token) {
    throw new Error(`Go2Pay auth failed (HTTP ${res.status})`)
  }

  const expiresInSec = Number(json.data.expires_in) > 0 ? Number(json.data.expires_in) : 3600
  tokenCache = {
    token: json.data.access_token,
    expiresAt: Date.now() + expiresInSec * 1000
  }
  return tokenCache.token
}

async function getToken({ force = false } = {}) {
  if (!force && tokenCache.token && Date.now() < tokenCache.expiresAt - EXPIRY_SKEW_MS) {
    return tokenCache.token
  }
  return login()
}

/** Authenticated fetch with a single re-auth retry on 401. */
async function apiFetch(path, options = {}, _retried = false) {
  const token = await getToken({ force: _retried })
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  })

  if (res.status === 401 && !_retried) {
    tokenCache = { token: null, expiresAt: 0 }
    return apiFetch(path, options, true)
  }
  return res
}

/**
 * POST /requests — create a one-time hosted Payment Request.
 * `payload` must use only documented fields:
 *   name, email, amount, phone, description, endpoint, success_url, error_url, send_email
 * Returns the `data` object: { id, payment_url, title, price, email, email_sent }.
 */
export async function createPaymentRequest(payload) {
  const res = await apiFetch('/requests', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  const json = await res.json().catch(() => null)

  if (!res.ok || !json?.data?.id || !json?.data?.payment_url) {
    throw new Error(`Go2Pay create-request failed (HTTP ${res.status})`)
  }
  return json.data
}

/**
 * GET /orders/{id} — retrieve a Go2Pay order for independent verification.
 * Returns { ok, status, data } where `data` is the unwrapped order object
 * (envelope is { success, message, data }); its exact fields are undocumented,
 * so callers must read defensively.
 */
export async function getOrder(id) {
  const res = await apiFetch(`/orders/${encodeURIComponent(String(id))}`, { method: 'GET' })
  const json = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data: json?.data ?? json ?? null }
}

/**
 * GET /requests/{id} — "single payment request with order stats".
 * Response fields undocumented; used only as an optional cross-check.
 */
export async function getPaymentRequest(id) {
  const res = await apiFetch(`/requests/${encodeURIComponent(String(id))}`, { method: 'GET' })
  const json = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data: json?.data ?? json ?? null }
}
