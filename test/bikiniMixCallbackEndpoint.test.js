import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Endpoint-level coverage for POST /api/payments/go2pay-bikini-mix/[token] —
 * the routing/lookup layer around server/utils/bikiniMixPayments.js (which
 * has its own dedicated, thorough test coverage in bikiniMixPayments.test.js).
 * This file proves: token-format rejection, missing-booking rejection,
 * non-PAID callbacks are a safe no-op, and a verified outcome triggers the
 * idempotent email dispatcher exactly once.
 */

vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))
vi.mock('../server/utils/bikiniMixPayments.js', () => ({ verifyAndConfirmBikiniMixBooking: vi.fn() }))
vi.mock('../server/utils/bikiniMixBookingEmails.js', () => ({ maybeSendBikiniMixBookingEmails: vi.fn() }))

import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'
import { verifyAndConfirmBikiniMixBooking } from '../server/utils/bikiniMixPayments.js'
import { maybeSendBikiniMixBookingEmails } from '../server/utils/bikiniMixBookingEmails.js'

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('readBody', async (e) => e._body)
  vi.stubGlobal('setResponseStatus', (e, s) => {
    e._status = s
  })
  vi.stubGlobal('getRouterParam', (e, k) => e._params?.[k])
  vi.stubGlobal('getRequestHeader', () => 'application/json')
}

const TOKEN = '11111111-1111-1111-1111-111111111111'
const PAID_BODY = { order_id: 'go-1', status: 'PAID', currency: 'USD', subtotal: 59.26 }

const event = (body, params = { token: TOKEN }) => ({ _body: body, _params: params, _status: 200 })

function fakeSupabase(bookingRow) {
  return {
    from: (table) => {
      if (table !== 'bikini_mix_bookings') throw new Error(`unexpected table ${table}`)
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: bookingRow, error: null }) }) }) }
    }
  }
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  maybeSendBikiniMixBookingEmails.mockResolvedValue(undefined)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

async function loadHandler() {
  stubGlobals()
  const mod = await import('../server/api/payments/go2pay-bikini-mix/[token].post.js')
  return mod.default
}

describe('POST /api/payments/go2pay-bikini-mix/[token]', () => {
  it('rejects a malformed token with 404 before any lookup', async () => {
    const handler = await loadHandler()
    supabaseAdmin.mockReturnValue(fakeSupabase(null))

    const e = event(PAID_BODY, { token: 'not-a-uuid' })
    const res = await handler(e)

    expect(e._status).toBe(404)
    expect(res).toEqual({ received: false })
    expect(verifyAndConfirmBikiniMixBooking).not.toHaveBeenCalled()
  })

  it('rejects a malformed body shape', async () => {
    const handler = await loadHandler()
    supabaseAdmin.mockReturnValue(fakeSupabase(null))

    const e = event({ foo: 'bar' })
    const res = await handler(e)

    expect(e._status).toBe(400)
    expect(res).toEqual({ received: false })
  })

  it('returns 404 when no booking matches the callback token', async () => {
    const handler = await loadHandler()
    supabaseAdmin.mockReturnValue(fakeSupabase(null))

    const e = event(PAID_BODY)
    const res = await handler(e)

    expect(e._status).toBe(404)
    expect(res).toEqual({ received: false })
  })

  it('is a safe no-op for a non-PAID callback on an unpaid booking', async () => {
    const handler = await loadHandler()
    supabaseAdmin.mockReturnValue(fakeSupabase({ id: 'bkg-1', paid_at: null }))

    const res = await handler(event({ order_id: 'go-1', status: 'PENDING', currency: 'USD', subtotal: 59.26 }))

    expect(res).toEqual({ received: true })
    expect(verifyAndConfirmBikiniMixBooking).not.toHaveBeenCalled()
  })

  it('verifies, and dispatches the idempotent email sender exactly once, on a confirmed outcome', async () => {
    const handler = await loadHandler()
    supabaseAdmin.mockReturnValue(fakeSupabase({ id: 'bkg-1', paid_at: null }))
    verifyAndConfirmBikiniMixBooking.mockResolvedValue({ outcome: 'confirmed', bookingId: 'bkg-1', status: 'confirmed' })

    const res = await handler(event(PAID_BODY))

    expect(res).toEqual({ received: true })
    expect(maybeSendBikiniMixBookingEmails).toHaveBeenCalledTimes(1)
    expect(maybeSendBikiniMixBookingEmails.mock.calls[0][1]).toBe('bkg-1')
  })

  it('still dispatches emails (idempotent retry) on an already-paid replay', async () => {
    const handler = await loadHandler()
    supabaseAdmin.mockReturnValue(fakeSupabase({ id: 'bkg-1', paid_at: '2026-10-19T01:00:00Z', status: 'confirmed' }))
    verifyAndConfirmBikiniMixBooking.mockResolvedValue({ outcome: 'already-paid', bookingId: 'bkg-1', status: 'confirmed' })

    const res = await handler(event(PAID_BODY))

    expect(res).toEqual({ received: true })
    expect(maybeSendBikiniMixBookingEmails).toHaveBeenCalledTimes(1)
  })

  it('does not dispatch emails when verification fails', async () => {
    const handler = await loadHandler()
    supabaseAdmin.mockReturnValue(fakeSupabase({ id: 'bkg-1', paid_at: null }))
    verifyAndConfirmBikiniMixBooking.mockResolvedValue({ outcome: 'verification-failed', bookingId: 'bkg-1' })

    const res = await handler(event(PAID_BODY))

    expect(res).toEqual({ received: true })
    expect(maybeSendBikiniMixBookingEmails).not.toHaveBeenCalled()
  })

  it('returns 502 without dispatching emails when the Go2Pay lookup itself fails', async () => {
    const handler = await loadHandler()
    supabaseAdmin.mockReturnValue(fakeSupabase({ id: 'bkg-1', paid_at: null }))
    verifyAndConfirmBikiniMixBooking.mockResolvedValue({ outcome: 'get-orders-failed', bookingId: 'bkg-1' })

    const e = event(PAID_BODY)
    const res = await handler(e)

    expect(e._status).toBe(502)
    expect(res).toEqual({ received: false })
    expect(maybeSendBikiniMixBookingEmails).not.toHaveBeenCalled()
  })
})
