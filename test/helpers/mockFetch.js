import { vi } from 'vitest'

/**
 * Build a `fetch` stub. `handler(url, parsedBody, opts)` returns
 * `{ ok?, status, json? }` (ok defaults to status < 400). Recorded calls are on
 * `.mock.calls` and, parsed, on the returned `.records` array.
 */
export function mockFetch(handler) {
  const records = []
  const fn = vi.fn(async (url, opts = {}) => {
    let body = null
    try {
      body = opts.body ? JSON.parse(opts.body) : null
    } catch {
      body = opts.body
    }
    records.push({ url, body, opts })
    const res = (await handler(url, body, opts)) || { status: 200 }
    const status = res.status ?? 200
    return {
      ok: res.ok ?? status < 400,
      status,
      json: async () => (typeof res.json === 'function' ? res.json() : (res.json ?? {}))
    }
  })
  fn.records = records
  return fn
}
