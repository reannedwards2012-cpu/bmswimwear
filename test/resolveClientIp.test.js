import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveClientIp } from '../server/utils/inquiryRateLimit.js'

/**
 * Phase 1 security hardening (follow-up review): resolveClientIp must
 * trust ONLY Netlify's verified x-nf-client-connection-ip header for abuse
 * protection. x-forwarded-for is explicitly never read, even as a
 * fallback, since Netlify does not guarantee or sanitize it — trusting it
 * would let an attacker bypass every rate limiter / the early-bird guard
 * by sending a different forged value per request.
 */

function event({ headers = {}, rawIp = null } = {}) {
  return { _headers: headers, _rawIp: rawIp }
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('getRequestHeader', (e, name) => e._headers[name.toLowerCase()] ?? null)
  vi.stubGlobal('getRequestIP', (e) => e._rawIp)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('resolveClientIp', () => {
  it('trusts x-nf-client-connection-ip when present', () => {
    const e = event({ headers: { 'x-nf-client-connection-ip': '203.0.113.5' } })
    expect(resolveClientIp(e)).toBe('203.0.113.5')
  })

  it('a forged x-forwarded-for is NEVER used when the Netlify header is present (Netlify header wins outright)', () => {
    const e = event({
      headers: {
        'x-nf-client-connection-ip': '203.0.113.5',
        'x-forwarded-for': '6.6.6.6, 203.0.113.5'
      }
    })
    expect(resolveClientIp(e)).toBe('203.0.113.5')
  })

  it('x-forwarded-for is NEVER read at all, even when the Netlify header is absent — falls back to the raw socket address instead', () => {
    const e = event({
      headers: { 'x-forwarded-for': '6.6.6.6' }, // attacker-controlled, must be ignored entirely
      rawIp: '198.51.100.9'
    })
    expect(resolveClientIp(e)).toBe('198.51.100.9')
  })

  it('logs a warning when falling back (expected in local dev, worth investigating in production)', () => {
    const warnSpy = vi.spyOn(console, 'warn')
    const e = event({ rawIp: '127.0.0.1' })
    resolveClientIp(e)
    expect(warnSpy).toHaveBeenCalled()
  })

  it('no header and no raw IP available -> null (callers skip IP throttling, fail open)', () => {
    vi.stubGlobal('getRequestIP', () => null)
    const e = event({})
    expect(resolveClientIp(e)).toBeNull()
  })

  it('getRequestIP throwing -> null, never throws up to the caller', () => {
    vi.stubGlobal('getRequestIP', () => {
      throw new Error('no socket')
    })
    const e = event({})
    expect(resolveClientIp(e)).toBeNull()
  })

  it('whitespace-only Netlify header is treated as absent (falls back, does not return blank)', () => {
    const e = event({ headers: { 'x-nf-client-connection-ip': '   ' }, rawIp: '198.51.100.9' })
    expect(resolveClientIp(e)).toBe('198.51.100.9')
  })
})
