import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockFetch } from './helpers/mockFetch.js'
import { verifyTurnstileToken, turnstileConfigured } from '../server/utils/turnstile.js'

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('turnstileConfigured', () => {
  it('false when TURNSTILE_SECRET_KEY is unset', () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    expect(turnstileConfigured()).toBe(false)
  })
  it('true once set', () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'sk_test')
    expect(turnstileConfigured()).toBe(true)
  })
})

describe('verifyTurnstileToken — not configured, dev/test environment', () => {
  it('skips verification (fails open) in NODE_ENV=test and never calls fetch', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    vi.stubEnv('NODE_ENV', 'test')
    const fetchFn = mockFetch(() => ({ status: 200, json: { success: true } }))
    vi.stubGlobal('fetch', fetchFn)

    const r = await verifyTurnstileToken('any-token', '203.0.113.5')
    expect(r).toEqual({ ok: true, skipped: true })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('skips verification (fails open) in NODE_ENV=development too', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    vi.stubEnv('NODE_ENV', 'development')
    const fetchFn = mockFetch(() => ({ status: 200, json: { success: true } }))
    vi.stubGlobal('fetch', fetchFn)

    expect(await verifyTurnstileToken('any-token', '203.0.113.5')).toEqual({ ok: true, skipped: true })
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

describe('verifyTurnstileToken — not configured, production (fails CLOSED)', () => {
  it('NODE_ENV=production + no secret key -> rejects, never calls fetch, never logs the (absent) key', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    vi.stubEnv('NODE_ENV', 'production')
    const fetchFn = mockFetch(() => ({ status: 200, json: { success: true } }))
    vi.stubGlobal('fetch', fetchFn)
    const errSpy = vi.spyOn(console, 'error')

    const r = await verifyTurnstileToken('any-token', '203.0.113.5')
    expect(r).toEqual({ ok: false, reason: 'not-configured' })
    expect(fetchFn).not.toHaveBeenCalled()
    expect(errSpy).toHaveBeenCalled()
  })

  it('an unrecognised/unset NODE_ENV defaults to the safe (production) posture, not fail-open', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    vi.stubEnv('NODE_ENV', '') // simulates a runtime that never sets NODE_ENV at all
    const fetchFn = mockFetch(() => ({ status: 200, json: { success: true } }))
    vi.stubGlobal('fetch', fetchFn)

    expect(await verifyTurnstileToken('any-token', '203.0.113.5')).toEqual({ ok: false, reason: 'not-configured' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('a missing secret key in production rejects even a token Cloudflare would otherwise accept', async () => {
    // Proves this isn't just "fetch was never called" by coincidence — even
    // if Cloudflare would say success, a config problem must still reject.
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    vi.stubEnv('NODE_ENV', 'production')
    const fetchFn = mockFetch(() => ({ status: 200, json: { success: true } }))
    vi.stubGlobal('fetch', fetchFn)

    const r = await verifyTurnstileToken('a-token-that-would-pass', '203.0.113.5')
    expect(r.ok).toBe(false)
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

describe('verifyTurnstileToken — configured', () => {
  beforeEach(() => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'sk_test_secret')
  })

  it('missing token -> rejected without calling Cloudflare', async () => {
    const fetchFn = mockFetch(() => ({ status: 200, json: { success: true } }))
    vi.stubGlobal('fetch', fetchFn)

    expect(await verifyTurnstileToken(undefined, '203.0.113.5')).toEqual({ ok: false, reason: 'missing-token' })
    expect(await verifyTurnstileToken('', '203.0.113.5')).toEqual({ ok: false, reason: 'missing-token' })
    expect(await verifyTurnstileToken('   ', '203.0.113.5')).toEqual({ ok: false, reason: 'missing-token' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('valid token -> ok:true, posts secret/response/remoteip to Cloudflare', async () => {
    const fetchFn = mockFetch(() => ({ status: 200, json: { success: true } }))
    vi.stubGlobal('fetch', fetchFn)

    const r = await verifyTurnstileToken('good-token', '203.0.113.5')
    expect(r).toEqual({ ok: true })

    const call = fetchFn.records[0]
    expect(call.url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(call.body).toEqual({ secret: 'sk_test_secret', response: 'good-token', remoteip: '203.0.113.5' })
  })

  it('valid token with no remote IP -> omits remoteip from the request', async () => {
    const fetchFn = mockFetch(() => ({ status: 200, json: { success: true } }))
    vi.stubGlobal('fetch', fetchFn)

    await verifyTurnstileToken('good-token', null)
    expect(fetchFn.records[0].body).toEqual({ secret: 'sk_test_secret', response: 'good-token' })
  })

  it('expired/already-used token -> reason "expired-token"', async () => {
    const fetchFn = mockFetch(() => ({ status: 200, json: { success: false, 'error-codes': ['timeout-or-duplicate'] } }))
    vi.stubGlobal('fetch', fetchFn)

    expect(await verifyTurnstileToken('stale-token', '203.0.113.5')).toEqual({
      ok: false,
      reason: 'expired-token',
      codes: ['timeout-or-duplicate']
    })
  })

  it('malformed/garbage token -> reason "invalid-token"', async () => {
    const fetchFn = mockFetch(() => ({ status: 200, json: { success: false, 'error-codes': ['invalid-input-response'] } }))
    vi.stubGlobal('fetch', fetchFn)

    expect(await verifyTurnstileToken('garbage', '203.0.113.5')).toEqual({
      ok: false,
      reason: 'invalid-token',
      codes: ['invalid-input-response']
    })
  })

  it('Cloudflare reports the response field itself missing -> reason "missing-token"', async () => {
    const fetchFn = mockFetch(() => ({ status: 200, json: { success: false, 'error-codes': ['missing-input-response'] } }))
    vi.stubGlobal('fetch', fetchFn)

    expect(await verifyTurnstileToken('whatever', '203.0.113.5')).toEqual({
      ok: false,
      reason: 'missing-token',
      codes: ['missing-input-response']
    })
  })

  it('network failure calling Cloudflare -> reason "verify-request-failed", fails closed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    expect(await verifyTurnstileToken('token', '203.0.113.5')).toEqual({ ok: false, reason: 'verify-request-failed' })
  })

  it('Cloudflare returns a non-OK HTTP status -> reason "verify-request-failed"', async () => {
    const fetchFn = mockFetch(() => ({ status: 503, json: {} }))
    vi.stubGlobal('fetch', fetchFn)
    expect(await verifyTurnstileToken('token', '203.0.113.5')).toEqual({ ok: false, reason: 'verify-request-failed' })
  })

  it('Cloudflare returns unparsable JSON -> reason "verify-request-failed"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad json') } }))
    )
    expect(await verifyTurnstileToken('token', '203.0.113.5')).toEqual({ ok: false, reason: 'verify-request-failed' })
  })

  it('an INVALID secret key (Cloudflare rejects it) -> reason "not-configured", fails closed', async () => {
    const fetchFn = mockFetch(() => ({ status: 200, json: { success: false, 'error-codes': ['invalid-input-secret'] } }))
    vi.stubGlobal('fetch', fetchFn)
    const errSpy = vi.spyOn(console, 'error')

    const r = await verifyTurnstileToken('token', '203.0.113.5')
    expect(r).toEqual({ ok: false, reason: 'not-configured', codes: ['invalid-input-secret'] })
    expect(errSpy).toHaveBeenCalled()
  })

  it('a missing secret key per Cloudflare (sent as empty string) -> reason "not-configured"', async () => {
    const fetchFn = mockFetch(() => ({ status: 200, json: { success: false, 'error-codes': ['missing-input-secret'] } }))
    vi.stubGlobal('fetch', fetchFn)
    expect(await verifyTurnstileToken('token', '203.0.113.5')).toEqual({
      ok: false,
      reason: 'not-configured',
      codes: ['missing-input-secret']
    })
  })

  it('an invalid secret key rejects regardless of environment, including dev/test', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const fetchFn = mockFetch(() => ({ status: 200, json: { success: false, 'error-codes': ['invalid-input-secret'] } }))
    vi.stubGlobal('fetch', fetchFn)
    expect((await verifyTurnstileToken('token', '203.0.113.5')).ok).toBe(false)
  })
})

describe('verifyTurnstileToken — the secret key is never logged', () => {
  it('no console.error/warn call, across every failure path, ever contains the secret value', async () => {
    const SECRET = 'sk_super_secret_value_12345'
    vi.stubEnv('TURNSTILE_SECRET_KEY', SECRET)
    const errSpy = vi.spyOn(console, 'error')
    const warnSpy = vi.spyOn(console, 'warn')

    // 1. invalid secret per Cloudflare
    vi.stubGlobal('fetch', mockFetch(() => ({ status: 200, json: { success: false, 'error-codes': ['invalid-input-secret'] } })))
    await verifyTurnstileToken('token', '203.0.113.5')

    // 2. network failure (error includes exception message, must not include secret)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    await verifyTurnstileToken('token', '203.0.113.5')

    // 3. not configured in production
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    vi.stubEnv('NODE_ENV', 'production')
    await verifyTurnstileToken('token', '203.0.113.5')

    const allLoggedText = [...errSpy.mock.calls, ...warnSpy.mock.calls].flat().join(' ')
    expect(allLoggedText).not.toContain(SECRET)
  })
})
