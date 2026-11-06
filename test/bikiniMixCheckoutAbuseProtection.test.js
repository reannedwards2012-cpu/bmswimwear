import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'

/**
 * Phase 1 security hardening — endpoint-level coverage for the abuse gates
 * on POST /api/bikini-mix/checkout: honeypot, Turnstile, rate limit, and
 * that `p_client_ip_hash` is correctly threaded into the
 * claim_bikini_mix_booking() RPC call.
 *
 * The Early Bird slot-exhaustion guard itself used to be tested here as
 * application-level logic — it has since moved INSIDE the RPC (v2 of the
 * fix, closing a check-then-act concurrency race the v1 app-level version
 * had). That SQL logic is covered by direct Postgres concurrency tests
 * (see the implementation report), not re-derived here with a JS mock of
 * a database lock, which couldn't meaningfully prove the fix anyway.
 *
 * Kept as its own file rather than extending
 * test/bikiniMixCheckoutEndpoint.test.js, whose shared fakeSupabase helper
 * is relied on by ~15 pre-existing tests with their own fixed call-sequence
 * expectations — safer not to reshape it.
 */

vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))
vi.mock('../server/utils/bikiniMixValidation.js', () => ({ validateBookingCheckout: vi.fn() }))
vi.mock('../server/utils/turnstile.js', () => ({ verifyTurnstileToken: vi.fn() }))
vi.mock('../server/utils/inquiryRateLimit.js', () => ({
  resolveClientIp: vi.fn(() => '203.0.113.5'),
  ipHash: vi.fn(() => 'hash-203.0.113.5')
}))
vi.mock('../server/utils/checkoutRateLimit.js', () => ({
  checkRateLimit: vi.fn(async () => ({ ok: true })),
  recordRateHit: vi.fn(async () => {})
}))

import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'
import { validateBookingCheckout } from '../server/utils/bikiniMixValidation.js'
import { verifyTurnstileToken } from '../server/utils/turnstile.js'
import { ipHash } from '../server/utils/inquiryRateLimit.js'
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

const VALID_BODY = { garmentType: 'onepiece', company: '', turnstileToken: 'tok-abc', checkoutIdempotencyKey: 'ckt-1' }
const VALID_FIELDS = { garmentType: 'onepiece', onepieceFabricId: 'fab-1', checkoutIdempotencyKey: 'ckt-1', email: 'jane@example.com' }

/** Minimal fake: fabrics/eligibility reads + a spyable .rpc() call. */
function fakeSupabase({ onepieceEligible = true, rpcResult = { data: null, error: { message: 'stop here' } } } = {}) {
  const rpcCalls = []
  return {
    from(table) {
      if (table === 'fabrics') {
        return { select: () => ({ in: () => Promise.resolve({ data: [{ id: 'fab-1', name: 'Coral', hex_color: '#E66B45', is_active: true, status: 'available' }], error: null }) }) }
      }
      if (table === 'bikini_mix_fabrics') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { eligible_for_onepiece: onepieceEligible }, error: null }) }) }) }
      }
      throw new Error(`unexpected table ${table}`)
    },
    rpc(name, args) {
      rpcCalls.push({ name, args })
      return Promise.resolve(rpcResult)
    },
    _rpcCalls: rpcCalls
  }
}

beforeAll(async () => {
  stubGlobals()
  const mod = await import('../server/api/bikini-mix/checkout.post.js')
  handler = mod.default
})

beforeEach(() => {
  stubGlobals()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  validateBookingCheckout.mockReset().mockReturnValue({ issues: [], fields: VALID_FIELDS })
  verifyTurnstileToken.mockReset().mockResolvedValue({ ok: true })
  ipHash.mockReset().mockReturnValue('hash-203.0.113.5')
  checkRateLimit.mockReset().mockResolvedValue({ ok: true })
  recordRateHit.mockReset().mockResolvedValue(undefined)
  supabaseAdmin.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('POST /api/bikini-mix/checkout — abuse protection', () => {
  it('honeypot tripped -> rejected before validation/Turnstile/the DB are ever touched', async () => {
    const e = event({ ...VALID_BODY, company: 'spam co' })
    const res = await handler(e)

    expect(res.success).toBe(false)
    expect(validateBookingCheckout).not.toHaveBeenCalled()
    expect(verifyTurnstileToken).not.toHaveBeenCalled()
  })

  it('missing Turnstile token -> 400, nothing claimed', async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: false, reason: 'missing-token' })
    supabaseAdmin.mockReturnValue(fakeSupabase())
    const e = event({ ...VALID_BODY, turnstileToken: '' })
    const res = await handler(e)

    expect(e._status).toBe(400)
    expect(res).toMatchObject({ success: false, reason: 'missing-token' })
  })

  it('expired Turnstile token -> 400, reason surfaced', async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: false, reason: 'expired-token' })
    const e = event(VALID_BODY)
    const res = await handler(e)
    expect(e._status).toBe(400)
    expect(res.reason).toBe('expired-token')
  })

  it('over the rate limit -> 429 with Retry-After, nothing claimed', async () => {
    checkRateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 600 })
    supabaseAdmin.mockReturnValue(fakeSupabase())
    const e = event(VALID_BODY)
    const res = await handler(e)

    expect(e._status).toBe(429)
    expect(e._headers['Retry-After']).toBe('600')
    expect(res.success).toBe(false)
  })

  describe('p_client_ip_hash is correctly threaded into claim_bikini_mix_booking()', () => {
    it('passes the resolved+hashed IP as p_client_ip_hash on every claim attempt', async () => {
      const fake = fakeSupabase()
      supabaseAdmin.mockReturnValue(fake)
      await handler(event(VALID_BODY))

      expect(fake._rpcCalls).toHaveLength(1)
      expect(fake._rpcCalls[0].name).toBe('claim_bikini_mix_booking')
      expect(fake._rpcCalls[0].args.p_client_ip_hash).toBe('hash-203.0.113.5')
    })

    it('passes null when IP hashing is not configured/resolvable — the RPC itself skips the per-IP guard in that case', async () => {
      ipHash.mockReturnValue(null)
      const fake = fakeSupabase()
      supabaseAdmin.mockReturnValue(fake)
      await handler(event(VALID_BODY))

      expect(fake._rpcCalls[0].args.p_client_ip_hash).toBeNull()
    })
  })
})
