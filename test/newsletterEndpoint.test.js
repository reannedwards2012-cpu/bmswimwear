import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockFetch } from './helpers/mockFetch.js'

/**
 * Endpoint-level coverage for server/api/newsletter.post.js. The h3 helpers it
 * relies on via Nitro auto-import are stubbed as globals BEFORE the handler is
 * imported; modules are reset per test so the in-memory rate-limit map is fresh.
 */
async function loadHandler() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('readBody', async (e) => e._body)
  vi.stubGlobal('setResponseStatus', (e, s) => {
    e._status = s
  })
  vi.stubGlobal('getRequestHeader', (e, k) => (e._headers || {})[k.toLowerCase()])
  vi.stubGlobal('getRequestIP', (e) => e._ip ?? null)
  vi.resetModules()
  return (await import('../server/api/newsletter.post.js')).default
}

const event = (body, ip = '203.0.113.5') => ({
  _body: body,
  _headers: { 'x-nf-client-connection-ip': ip },
  _status: 200
})

beforeEach(() => {
  vi.stubEnv('BREVO_API_KEY', 'test-key')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('POST /api/newsletter', () => {
  it('honeypot submission → fake success, zero Brevo calls', async () => {
    const fetchFn = mockFetch(() => ({ status: 201 }))
    vi.stubGlobal('fetch', fetchFn)
    const handler = await loadHandler()

    const res = await handler(event({ email: 'bot@spam.com', company: 'Acme Inc' }))
    expect(res).toEqual({ ok: true })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('invalid email → 400, no contact created', async () => {
    const fetchFn = mockFetch(() => ({ status: 201 }))
    vi.stubGlobal('fetch', fetchFn)
    const handler = await loadHandler()

    const ev = event({ email: 'not-an-email' })
    const res = await handler(ev)
    expect(res.ok).toBe(false)
    expect(ev._status).toBe(400)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('valid new signup → contact upserted to list 3, and NO email is sent', async () => {
    const fetchFn = mockFetch((url) =>
      url.endsWith('/contacts') ? { status: 201, json: { id: 1 } } : { status: 201, json: {} }
    )
    vi.stubGlobal('fetch', fetchFn)
    const handler = await loadHandler()

    const res = await handler(event({ email: 'Her@Example.com' }))
    expect(res).toEqual({ ok: true })

    const contactCall = fetchFn.records.find((r) => r.url.endsWith('/contacts'))
    expect(contactCall.body).toMatchObject({ email: 'her@example.com', listIds: [3], updateEnabled: true })
    // the website never sends the welcome — that's a Brevo Automation on List #3
    expect(fetchFn.records.some((r) => r.url.endsWith('/smtp/email'))).toBe(false)
    expect(fetchFn.records.every((r) => r.url.endsWith('/contacts'))).toBe(true)
  })

  it('duplicate signup → graceful success, still no email', async () => {
    const fetchFn = mockFetch((url) =>
      url.endsWith('/contacts') ? { status: 204 } : { status: 201, json: {} }
    )
    vi.stubGlobal('fetch', fetchFn)
    const handler = await loadHandler()

    const res = await handler(event({ email: 'dupe@example.com' }))
    expect(res).toEqual({ ok: true })
    expect(fetchFn.records.some((r) => r.url.endsWith('/smtp/email'))).toBe(false)
  })

  it('Brevo contact failure → 502, not a false success', async () => {
    const fetchFn = mockFetch(() => ({ status: 500, json: { code: 'err' } }))
    vi.stubGlobal('fetch', fetchFn)
    const handler = await loadHandler()

    const ev = event({ email: 'her@example.com' })
    const res = await handler(ev)
    expect(res.ok).toBe(false)
    expect(ev._status).toBe(502)
  })

  it('soft rate limit kicks in after 5 attempts from one IP in the window', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch((url) => (url.endsWith('/contacts') ? { status: 204 } : { status: 201, json: {} }))
    )
    const handler = await loadHandler()

    const statuses = []
    for (let i = 0; i < 6; i++) {
      const ev = event({ email: `person${i}@example.com` }, '198.51.100.9')
      await handler(ev)
      statuses.push(ev._status)
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200])
    expect(statuses[5]).toBe(429)
  })
})
