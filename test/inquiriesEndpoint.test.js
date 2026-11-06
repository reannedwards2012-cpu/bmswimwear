import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'

/**
 * Endpoint-level coverage for POST /api/inquiries — proves the orchestration
 * (honeypot -> validation -> Turnstile -> rate limit -> store -> email),
 * same stubbed-globals + mocked-Supabase approach as
 * test/bikiniMixCheckoutEndpoint.test.js. Turnstile's own verification logic
 * is unit-tested separately in test/turnstile.test.js, and the rate limiter's
 * own threshold logic in test/inquiryRateLimit.test.js — both are mocked
 * here so this file only proves the endpoint wires them together correctly
 * and in the right order.
 */

vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))
vi.mock('../server/utils/turnstile.js', () => ({ verifyTurnstileToken: vi.fn() }))
vi.mock('../server/utils/inquiryRateLimit.js', () => ({
  resolveClientIp: vi.fn(() => '203.0.113.5'),
  ipHash: vi.fn(() => 'hash-203.0.113.5'),
  checkInquiryRateLimit: vi.fn(),
  recordInquiryRateHit: vi.fn()
}))
vi.mock('../server/utils/inquiryEmails.js', () => ({ sendInquiryEmails: vi.fn() }))

import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'
import { verifyTurnstileToken } from '../server/utils/turnstile.js'
import { checkInquiryRateLimit, recordInquiryRateHit } from '../server/utils/inquiryRateLimit.js'
import { sendInquiryEmails } from '../server/utils/inquiryEmails.js'
import { createFakeSupabase } from './helpers/fakeSupabase.js'

let handler

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('readBody', async (e) => e._body)
  vi.stubGlobal('setResponseStatus', (e, s) => {
    e._status = s
  })
  vi.stubGlobal('setResponseHeader', (e, k, v) => {
    e._headers[k] = v
  })
}

const event = (body) => ({ _body: body, _status: 200, _headers: {} })

const VALID_BODY = {
  firstName: 'Jane',
  lastName: 'Guest',
  email: 'jane@example.com',
  phone: '',
  subject: 'Custom / bespoke design',
  message: 'Hello, I would like a custom piece for an upcoming trip.',
  company: '', // honeypot, empty = human
  turnstileToken: 'tok-abc123'
}

beforeAll(async () => {
  stubGlobals()
  const mod = await import('../server/api/inquiries.post.js')
  handler = mod.default
})

beforeEach(() => {
  stubGlobals()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  verifyTurnstileToken.mockReset().mockResolvedValue({ ok: true })
  checkInquiryRateLimit.mockReset().mockResolvedValue({ ok: true })
  recordInquiryRateHit.mockReset().mockResolvedValue(undefined)
  sendInquiryEmails.mockReset().mockResolvedValue(undefined)
  supabaseAdmin.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('POST /api/inquiries', () => {
  it('honeypot tripped -> fake success, never touches Turnstile, the DB, or email', async () => {
    const e = event({ ...VALID_BODY, company: 'I am a spam bot' })
    const res = await handler(e)

    expect(res).toEqual({ ok: true })
    expect(e._status).toBe(200)
    expect(verifyTurnstileToken).not.toHaveBeenCalled()
    expect(checkInquiryRateLimit).not.toHaveBeenCalled()
    expect(sendInquiryEmails).not.toHaveBeenCalled()
  })

  it('invalid payload -> 400 before Turnstile is ever called', async () => {
    const e = event({ ...VALID_BODY, email: 'not-an-email' })
    const res = await handler(e)

    expect(e._status).toBe(400)
    expect(res.ok).toBe(false)
    expect(res.issues).toBeTruthy()
    expect(verifyTurnstileToken).not.toHaveBeenCalled()
  })

  it('missing Turnstile token -> 400, nothing stored, no email sent', async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: false, reason: 'missing-token' })
    const e = event({ ...VALID_BODY, turnstileToken: '' })
    const res = await handler(e)

    expect(e._status).toBe(400)
    expect(res).toMatchObject({ ok: false, reason: 'missing-token' })
    expect(checkInquiryRateLimit).not.toHaveBeenCalled()
    expect(sendInquiryEmails).not.toHaveBeenCalled()
  })

  it('expired Turnstile token -> 400, reason surfaced, nothing stored', async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: false, reason: 'expired-token' })
    const e = event(VALID_BODY)
    const res = await handler(e)

    expect(e._status).toBe(400)
    expect(res).toMatchObject({ ok: false, reason: 'expired-token' })
    expect(sendInquiryEmails).not.toHaveBeenCalled()
  })

  it('invalid Turnstile token -> 400, reason surfaced, nothing stored', async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: false, reason: 'invalid-token' })
    const e = event(VALID_BODY)
    const res = await handler(e)

    expect(e._status).toBe(400)
    expect(res).toMatchObject({ ok: false, reason: 'invalid-token' })
    expect(sendInquiryEmails).not.toHaveBeenCalled()
  })

  it('missing/invalid Turnstile secret key ("not-configured") -> 400, fails CLOSED, nothing stored', async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: false, reason: 'not-configured' })
    const e = event(VALID_BODY)
    const res = await handler(e)

    expect(e._status).toBe(400)
    expect(res).toMatchObject({ ok: false, reason: 'not-configured' })
    expect(checkInquiryRateLimit).not.toHaveBeenCalled()
    expect(sendInquiryEmails).not.toHaveBeenCalled()
  })

  it('a failed verify request (Cloudflare unreachable) fails CLOSED -> 400, nothing stored', async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: false, reason: 'verify-request-failed' })
    const e = event(VALID_BODY)
    const res = await handler(e)

    expect(e._status).toBe(400)
    expect(res.ok).toBe(false)
    expect(sendInquiryEmails).not.toHaveBeenCalled()
  })

  it('valid token + under the rate limit -> verifies IP/token, stores, emails, returns {ok:true}', async () => {
    const fake = createFakeSupabase([{ data: { id: 'inq-1' }, error: null }])
    supabaseAdmin.mockReturnValue(fake)

    const e = event(VALID_BODY)
    const res = await handler(e)

    expect(res).toEqual({ ok: true })
    expect(e._status).toBe(200)
    expect(verifyTurnstileToken).toHaveBeenCalledWith('tok-abc123', '203.0.113.5')
    expect(checkInquiryRateLimit).toHaveBeenCalledWith(fake, { ipHashValue: 'hash-203.0.113.5', email: 'jane@example.com' })
    expect(recordInquiryRateHit).toHaveBeenCalledWith(fake, 'hash-203.0.113.5')
    expect(sendInquiryEmails).toHaveBeenCalledTimes(1)
    expect(sendInquiryEmails.mock.calls[0][0]).toMatchObject({ id: 'inq-1', email: 'jane@example.com', firstName: 'Jane' })

    // Never echoes the stored row/id back to the caller.
    expect(res.id).toBeUndefined()
  })

  it('over the rate limit -> 429 with Retry-After, even with a valid token; nothing stored', async () => {
    checkInquiryRateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 600 })
    const e = event(VALID_BODY)
    const res = await handler(e)

    expect(e._status).toBe(429)
    expect(e._headers['Retry-After']).toBe('600')
    expect(res.ok).toBe(false)
    expect(recordInquiryRateHit).not.toHaveBeenCalled()
    expect(sendInquiryEmails).not.toHaveBeenCalled()
  })

  it('DB insert failure after every gate passes -> 500, generic error, no email sent', async () => {
    const fake = createFakeSupabase([{ data: null, error: { message: 'db down' } }])
    supabaseAdmin.mockReturnValue(fake)

    const e = event(VALID_BODY)
    const res = await handler(e)

    expect(e._status).toBe(500)
    expect(res.ok).toBe(false)
    expect(sendInquiryEmails).not.toHaveBeenCalled()
  })

  it('an email dispatch failure never changes the {ok:true} response — the inquiry is already stored', async () => {
    const fake = createFakeSupabase([{ data: { id: 'inq-2' }, error: null }])
    supabaseAdmin.mockReturnValue(fake)
    sendInquiryEmails.mockRejectedValue(new Error('brevo down'))

    const e = event(VALID_BODY)
    const res = await handler(e)

    expect(res).toEqual({ ok: true })
    expect(e._status).toBe(200)
  })
})
