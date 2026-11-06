import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { createFakeSupabase } from './helpers/fakeSupabase.js'

/**
 * Phase 1 security hardening — endpoint-level coverage for the NEW abuse
 * gates on POST /api/checkout (honeypot, Turnstile, rate limit). The
 * pre-existing order/payment state machine (idempotency, Go2Pay request
 * claim/finalize) is proven elsewhere (server/utils/checkoutOrder.js's own
 * tests) and is only exercised here enough to prove a legitimate submission
 * still reaches it — not re-derived in full.
 */

vi.mock('../server/utils/checkoutOrder.js', () => ({ buildValidatedOrder: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))
vi.mock('../server/utils/productCatalogue.js', () => ({ fetchCatalogueForCheckout: vi.fn() }))
vi.mock('../server/utils/go2pay.js', () => ({ createPaymentRequest: vi.fn(), getPaymentRequest: vi.fn() }))
vi.mock('../server/utils/siteUrl.js', () => ({ siteUrl: () => 'https://bmswimwear.com' }))
vi.mock('../server/utils/authUser.js', () => ({ getOptionalUserId: vi.fn(async () => null) }))
vi.mock('../server/utils/turnstile.js', () => ({ verifyTurnstileToken: vi.fn() }))
vi.mock('../server/utils/inquiryRateLimit.js', () => ({
  resolveClientIp: vi.fn(() => '203.0.113.5'),
  ipHash: vi.fn(() => 'hash-203.0.113.5')
}))
vi.mock('../server/utils/checkoutRateLimit.js', () => ({
  checkRateLimit: vi.fn(async () => ({ ok: true })),
  recordRateHit: vi.fn(async () => {})
}))

import { buildValidatedOrder } from '../server/utils/checkoutOrder.js'
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'
import { fetchCatalogueForCheckout } from '../server/utils/productCatalogue.js'
import { createPaymentRequest } from '../server/utils/go2pay.js'
import { verifyTurnstileToken } from '../server/utils/turnstile.js'
import { checkRateLimit, recordRateHit } from '../server/utils/checkoutRateLimit.js'

let handler

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('readBody', async (e) => e._body)
  vi.stubGlobal('setResponseStatus', (e, s) => {
    e._status = s
  })
  vi.stubGlobal('setResponseHeader', (e, k, v) => {
    e._headers = { ...(e._headers || {}), [k]: v }
  })
}
const event = (body) => ({ _body: body, _status: 200, _headers: {} })

const VALID_BODY = { items: [{ productId: 'reef', quantity: 1 }], company: '', turnstileToken: 'tok-abc' }

const ORDER_ROW = {
  checkout_idempotency_key: '11111111-1111-1111-1111-111111111111',
  first_name: 'Jane',
  email: 'jane@example.com'
}
const ORDER_RESULT = { ok: true, orderRow: { ...ORDER_ROW }, itemRows: [{ product_name: 'Reef Top' }] }

beforeAll(async () => {
  stubGlobals()
  const mod = await import('../server/api/checkout.post.js')
  handler = mod.default
})

beforeEach(() => {
  stubGlobals()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  buildValidatedOrder.mockReset().mockReturnValue(ORDER_RESULT)
  fetchCatalogueForCheckout.mockReset().mockResolvedValue(new Map())
  verifyTurnstileToken.mockReset().mockResolvedValue({ ok: true })
  checkRateLimit.mockReset().mockResolvedValue({ ok: true })
  recordRateHit.mockReset().mockResolvedValue(undefined)
  createPaymentRequest.mockReset()
  supabaseAdmin.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('POST /api/checkout — abuse protection', () => {
  it('honeypot tripped -> rejected before the catalogue is ever fetched', async () => {
    const e = event({ ...VALID_BODY, company: 'I am a bot' })
    const res = await handler(e)

    expect(res.success).toBe(false)
    expect(fetchCatalogueForCheckout).not.toHaveBeenCalled()
    expect(verifyTurnstileToken).not.toHaveBeenCalled()
  })

  it('missing Turnstile token -> 400, nothing created', async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: false, reason: 'missing-token' })
    const e = event({ ...VALID_BODY, turnstileToken: '' })
    const res = await handler(e)

    expect(e._status).toBe(400)
    expect(res).toMatchObject({ success: false, reason: 'missing-token' })
    expect(fetchCatalogueForCheckout).not.toHaveBeenCalled()
    expect(checkRateLimit).not.toHaveBeenCalled()
  })

  it('expired Turnstile token -> 400, reason surfaced, nothing created', async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: false, reason: 'expired-token' })
    const e = event(VALID_BODY)
    const res = await handler(e)
    expect(e._status).toBe(400)
    expect(res.reason).toBe('expired-token')
  })

  it('invalid Turnstile token -> 400', async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: false, reason: 'invalid-token' })
    const e = event(VALID_BODY)
    const res = await handler(e)
    expect(e._status).toBe(400)
    expect(res.reason).toBe('invalid-token')
  })

  it('missing/invalid Turnstile secret key ("not-configured") fails CLOSED -> 400', async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: false, reason: 'not-configured' })
    const e = event(VALID_BODY)
    const res = await handler(e)
    expect(e._status).toBe(400)
    expect(res.success).toBe(false)
    expect(fetchCatalogueForCheckout).not.toHaveBeenCalled()
  })

  it('over the rate limit -> 429 with Retry-After, even with a valid Turnstile token; nothing created', async () => {
    checkRateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 600 })
    const e = event(VALID_BODY)
    const res = await handler(e)

    expect(e._status).toBe(429)
    expect(e._headers['Retry-After']).toBe('600')
    expect(res.success).toBe(false)
    expect(fetchCatalogueForCheckout).not.toHaveBeenCalled()
    expect(recordRateHit).not.toHaveBeenCalled()
  })

  it('a legitimate submission passes every gate and reaches order/payment creation', async () => {
    const fake = createFakeSupabase([
      { data: null, error: null }, // idempotency lookup — no existing order
      { data: { ...ORDER_ROW, id: 'ord-1', order_number: 42, status: 'pending' }, error: null }, // insert
      { data: null, error: null }, // order_items insert
      { data: [{ id: 'ord-1' }], error: null } // CLAIM update
      // FINALIZE update queued below after createPaymentRequest resolves
    ])
    supabaseAdmin.mockReturnValue(fake)
    createPaymentRequest.mockResolvedValue({ id: 999, payment_url: 'https://go2pay.gd/pay/999' })
    fake._queue.push({ data: [{ id: 'ord-1' }], error: null }) // FINALIZE update

    const e = event(VALID_BODY)
    const res = await handler(e)

    expect(verifyTurnstileToken).toHaveBeenCalledWith('tok-abc', '203.0.113.5')
    expect(checkRateLimit).toHaveBeenCalledTimes(1)
    expect(recordRateHit).toHaveBeenCalledTimes(1)
    expect(res).toMatchObject({ success: true, paymentUrl: 'https://go2pay.gd/pay/999' })
  })
})
