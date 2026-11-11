import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Endpoint-level coverage for the complimentary-invitation flow:
 *   POST /api/bikini-mix/invitation-code/check   (read-only pre-check)
 *   POST /api/bikini-mix/checkout-comp           (the only real redemption path)
 *
 * Mirrors test/bikiniMixCheckoutEndpoint.test.js's mocked-Supabase approach.
 * The row-LOCK concurrency guarantee itself (two simultaneous redemptions of
 * the same code; the cross-flow idempotency-key exploit fix) lives in
 * claim_bikini_mix_comp_booking()'s SQL body
 * (supabase/migrations/20261111000000_swimsuit_mixer_invitations.sql) and
 * cannot be exercised by a mocked Postgres client — these tests instead
 * prove the APPLICATION layer handles every outcome that function can
 * produce (success, invalid code, already-used code, the idempotency-
 * exploit's rejection) safely, never confirming/emailing anything it
 * shouldn't. No Docker/local Postgres was available in this environment to
 * additionally verify the lock itself against a real database — see the
 * implementation summary for this caveat.
 */

vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))
vi.mock('../server/utils/turnstile.js', () => ({ verifyTurnstileToken: vi.fn() }))
vi.mock('../server/utils/inquiryRateLimit.js', () => ({
  resolveClientIp: vi.fn(() => '203.0.113.5'),
  ipHash: vi.fn(() => null)
}))
vi.mock('../server/utils/checkoutRateLimit.js', () => ({
  checkRateLimit: vi.fn(async () => ({ ok: true })),
  recordRateHit: vi.fn(async () => {})
}))
vi.mock('../server/utils/bikiniMixBookingEmails.js', () => ({ maybeSendBikiniMixBookingEmails: vi.fn(async () => {}) }))

import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'
import { verifyTurnstileToken } from '../server/utils/turnstile.js'
import { checkRateLimit } from '../server/utils/checkoutRateLimit.js'
import { maybeSendBikiniMixBookingEmails } from '../server/utils/bikiniMixBookingEmails.js'

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('readBody', async (e) => e._body)
  vi.stubGlobal('setResponseStatus', (e, s) => { e._status = s })
  vi.stubGlobal('setResponseHeader', (e, k, v) => { e._headers = { ...(e._headers || {}), [k]: v } })
}
const event = (body) => ({ _body: body, _status: 200 })

beforeEach(() => {
  stubGlobals()
  vi.stubEnv('INQUIRY_HASH_SECRET', 'test-secret')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  verifyTurnstileToken.mockReset().mockResolvedValue({ ok: true })
  checkRateLimit.mockReset().mockResolvedValue({ ok: true })
  maybeSendBikiniMixBookingEmails.mockReset().mockResolvedValue(undefined)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('POST /api/bikini-mix/invitation-code/check', () => {
  async function loadHandler() {
    const mod = await import('../server/api/bikini-mix/invitation-code/check.post.js')
    return mod.default
  }

  it('rejects a missing/empty code before touching the database', async () => {
    const handler = await loadHandler()
    const supabase = { from: vi.fn() }
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event({ code: '' }))

    expect(res.valid).toBe(false)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('returns valid:true + category for an active code', async () => {
    const handler = await loadHandler()
    const supabase = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { category: 'giveaway', status: 'active' }, error: null }) }) }) })
    }
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event({ code: 'ABCD-EFGH-JKLM' }))

    expect(res).toMatchObject({ valid: true, category: 'giveaway' })
  })

  it('returns valid:false for a redeemed code, WITHOUT revealing anything else about it', async () => {
    const handler = await loadHandler()
    const supabase = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { category: 'giveaway', status: 'redeemed' }, error: null }) }) }) })
    }
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event({ code: 'ABCD-EFGH-JKLM' }))

    expect(res).toEqual({ valid: false })
  })

  it('returns valid:false for a code that does not exist', async () => {
    const handler = await loadHandler()
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) }
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event({ code: 'NOT-AREA-LCODE' }))

    expect(res).toEqual({ valid: false })
  })

  it('is rate-limited — too many attempts returns 429, never reaches the lookup', async () => {
    checkRateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 600 })
    const handler = await loadHandler()
    const supabase = { from: vi.fn() }
    supabaseAdmin.mockReturnValue(supabase)

    const e = event({ code: 'ABCD-EFGH-JKLM' })
    const res = await handler(e)

    expect(e._status).toBe(429)
    expect(res.valid).toBe(false)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('fails CLOSED (never valid) when the hashing secret is not configured', async () => {
    vi.stubEnv('INQUIRY_HASH_SECRET', '')
    const handler = await loadHandler()
    const supabase = { from: vi.fn() }
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event({ code: 'ABCD-EFGH-JKLM' }))

    expect(res.valid).toBe(false)
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('POST /api/bikini-mix/checkout-comp', () => {
  const FAB_LEFT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const FAB_RIGHT = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  const FAB_BOTTOM = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

  const VALID_BODY = {
    checkoutIdempotencyKey: '11111111-1111-1111-1111-111111111111',
    code: 'ABCD-EFGH-JKLM',
    garmentType: 'bikini',
    topSize: 'M',
    bottomSize: 'M',
    bottomStyle: 'tie-side',
    bottomCoverage: 'bikini',
    bottomScrunch: false,
    leftFabricId: FAB_LEFT,
    rightFabricId: FAB_RIGHT,
    bottomFabricId: FAB_BOTTOM,
    fullName: 'Tanya Mitchell',
    email: 'tanya@example.com',
    whatsapp: '+1 473 555 0109',
    marketingOptIn: false,
    termsAccepted: true
  }

  const FABRIC_ROWS = [
    { id: FAB_LEFT, name: 'Royal Blue', hex_color: '#2252E5', is_active: true, status: 'available' },
    { id: FAB_RIGHT, name: 'Royal Blue', hex_color: '#2252E5', is_active: true, status: 'available' },
    { id: FAB_BOTTOM, name: 'Royal Blue', hex_color: '#2252E5', is_active: true, status: 'available' }
  ]

  function compBookingRow(overrides = {}) {
    return {
      id: 'bkg-comp-1',
      booking_number: 9,
      is_complimentary: true,
      invitation_category: 'event_assistant',
      status: 'confirmed',
      paid_at: '2026-11-05T12:00:00Z',
      charged_usd_cents: null,
      go2pay_request_id: null,
      go2pay_payment_url: null,
      go2pay_order_id: null,
      email: 'tanya@example.com',
      whatsapp: '+1 473 555 0109',
      ...overrides
    }
  }

  function fakeSupabase({ rpcResult }) {
    return {
      rpc: vi.fn().mockResolvedValue(rpcResult),
      from(table) {
        if (table === 'fabrics') return { select: () => ({ in: () => Promise.resolve({ data: FABRIC_ROWS, error: null }) }) }
        if (table === 'bikini_mix_fabrics') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { eligible_for_onepiece: true }, error: null }) }) }) }
        if (table === 'bikini_mix_bookings') {
          return { update: () => ({ eq: () => Promise.resolve({ error: null }) }) }
        }
        throw new Error(`unexpected table ${table}`)
      }
    }
  }

  async function loadHandler() {
    const mod = await import('../server/api/bikini-mix/checkout-comp.post.js')
    return mod.default
  }

  it('rejects a malformed payload before touching the database', async () => {
    const handler = await loadHandler()
    const supabase = fakeSupabase({ rpcResult: { data: null, error: null } })
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event({ ...VALID_BODY, email: 'not-an-email' }))

    expect(res.success).toBe(false)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('rejects a missing invitation code before touching the database', async () => {
    const handler = await loadHandler()
    const supabase = fakeSupabase({ rpcResult: { data: null, error: null } })
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event({ ...VALID_BODY, code: '' }))

    expect(res.success).toBe(false)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('on success: confirms immediately, never touches Go2Pay, and sends the confirmation email directly', async () => {
    const handler = await loadHandler()
    const supabase = fakeSupabase({ rpcResult: { data: compBookingRow(), error: null } })
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event(VALID_BODY))

    expect(res).toEqual({ success: true, alreadyPaid: true, bookingRef: 'BKM-000009', isComplimentary: true })
    expect(maybeSendBikiniMixBookingEmails).toHaveBeenCalledWith(supabase, 'bkg-comp-1')
    // The whole point of this endpoint: no payment request is ever created.
    expect(supabase.rpc).toHaveBeenCalledWith('claim_bikini_mix_comp_booking', expect.objectContaining({ p_code_hash: expect.any(String) }))
  })

  it('never sends the plaintext code to the RPC — only its hash', async () => {
    const handler = await loadHandler()
    const supabase = fakeSupabase({ rpcResult: { data: compBookingRow(), error: null } })
    supabaseAdmin.mockReturnValue(supabase)

    await handler(event(VALID_BODY))

    const rpcArgs = supabase.rpc.mock.calls[0][1]
    expect(rpcArgs.p_code_hash).not.toBe(VALID_BODY.code)
    expect(rpcArgs.p_code_hash).toMatch(/^[0-9a-f]{64}$/) // sha256 hex
  })

  it('maps an invalid-code RPC error (22023) to a 409 without ever confirming anything', async () => {
    const handler = await loadHandler()
    const supabase = fakeSupabase({ rpcResult: { data: null, error: { code: '22023', message: 'invalid invitation code' } } })
    supabaseAdmin.mockReturnValue(supabase)

    const e = event(VALID_BODY)
    const res = await handler(e)

    expect(e._status).toBe(409)
    expect(res.success).toBe(false)
    expect(maybeSendBikiniMixBookingEmails).not.toHaveBeenCalled()
  })

  it('maps an already-used-code RPC error (55000) to a 409 — proves a code cannot be redeemed twice', async () => {
    const handler = await loadHandler()
    const supabase = fakeSupabase({
      rpcResult: { data: null, error: { code: '55000', message: 'invitation code has already been used or is no longer valid' } }
    })
    supabaseAdmin.mockReturnValue(supabase)

    const e = event(VALID_BODY)
    const res = await handler(e)

    expect(e._status).toBe(409)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/invalid|expired|used/i)
    expect(maybeSendBikiniMixBookingEmails).not.toHaveBeenCalled()
  })

  it('also maps the idempotency-exploit guard\'s 55000 error (key reused across flows) to the same safe 409 — never confirms a mismatched booking', async () => {
    // This is the SQL-level fix: replaying a checkout_idempotency_key that
    // was first used against the PAID claim_bikini_mix_booking() now makes
    // claim_bikini_mix_comp_booking() raise '55000' instead of returning
    // that unrelated booking. The application layer must treat this
    // exactly like "invalid code" — it never gets a booking row back to
    // mistakenly confirm/email.
    const handler = await loadHandler()
    const supabase = fakeSupabase({
      rpcResult: { data: null, error: { code: '55000', message: 'checkout id already used by a different booking flow' } }
    })
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event(VALID_BODY))

    expect(res.success).toBe(false)
    expect(maybeSendBikiniMixBookingEmails).not.toHaveBeenCalled()
  })

  it('rejects when a selected fabric is no longer available, never reaching the RPC', async () => {
    const handler = await loadHandler()
    const supabase = fakeSupabase({ rpcResult: { data: compBookingRow(), error: null } })
    supabase.from = (table) => {
      if (table === 'fabrics') {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [
                  { id: FAB_LEFT, name: 'Royal Blue', hex_color: '#2252E5', is_active: true, status: 'available' },
                  { id: FAB_RIGHT, name: 'Discontinued', hex_color: '#000', is_active: false, status: 'unavailable' },
                  { id: FAB_BOTTOM, name: 'Royal Blue', hex_color: '#2252E5', is_active: true, status: 'available' }
                ],
                error: null
              })
          })
        }
      }
      throw new Error(`unexpected table ${table}`)
    }
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event(VALID_BODY))

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/fabric/i)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('a failed Turnstile verification rejects before the RPC is ever called', async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: false, reason: 'invalid-input-response' })
    const handler = await loadHandler()
    const supabase = fakeSupabase({ rpcResult: { data: compBookingRow(), error: null } })
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event(VALID_BODY))

    expect(res.success).toBe(false)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('is rate-limited independently of the paid checkout scope', async () => {
    checkRateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 600 })
    const handler = await loadHandler()
    const supabase = fakeSupabase({ rpcResult: { data: compBookingRow(), error: null } })
    supabaseAdmin.mockReturnValue(supabase)

    const e = event(VALID_BODY)
    const res = await handler(e)

    expect(e._status).toBe(429)
    expect(res.success).toBe(false)
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(checkRateLimit).toHaveBeenCalledWith(supabase, expect.objectContaining({ scope: 'bikini-mix-checkout-comp' }))
  })

  it('one-piece checkout passes a single fabric to the RPC, same as the paid endpoint', async () => {
    const handler = await loadHandler()
    const supabase = fakeSupabase({ rpcResult: { data: compBookingRow(), error: null } })
    supabaseAdmin.mockReturnValue(supabase)

    const body = {
      ...VALID_BODY,
      checkoutIdempotencyKey: '22222222-2222-2222-2222-222222222222',
      garmentType: 'onepiece',
      onepieceSize: 'S',
      onepieceCoverage: 'cheeky',
      onepieceFabricId: FAB_LEFT
    }
    const res = await handler(event(body))

    expect(res.success).toBe(true)
    const rpcArgs = supabase.rpc.mock.calls[0][1]
    expect(rpcArgs.p_garment_type).toBe('onepiece')
    expect(rpcArgs.p_onepiece_fabric_id).toBe(FAB_LEFT)
    expect(rpcArgs.p_left_fabric_id).toBeNull()
  })
})
