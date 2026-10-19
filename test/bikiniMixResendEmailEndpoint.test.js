import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Endpoint-level coverage for POST /api/admin/bikini-mix/bookings/:id/resend-email.
 * Proves: admin gating, confirmed+paid gating (refuses pending/needs_review/
 * cancelled/unpaid), the cooldown against accidental double-sends, that it
 * never touches capacity/RPCs/payment, and that a successful send bumps
 * paid_email_sent_at.
 */

vi.mock('../server/utils/authUser.js', () => ({ requireAdmin: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))
vi.mock('../server/utils/brevo.js', () => ({ sendTransactionalEmail: vi.fn() }))

import { requireAdmin } from '../server/utils/authUser.js'
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'
import { sendTransactionalEmail } from '../server/utils/brevo.js'

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('setResponseStatus', (e, s) => {
    e._status = s
  })
  vi.stubGlobal('getRouterParam', (e, k) => e._params?.[k])
}

const BOOKING_ID = '11111111-1111-1111-1111-111111111111'
const event = (params = { id: BOOKING_ID }) => ({ _params: params, _status: 200 })

function confirmedBookingRow(overrides = {}) {
  return {
    id: BOOKING_ID,
    booking_number: 42,
    status: 'confirmed',
    package: 'classic_mix',
    retail_price_xcd_cents: 16000,
    charged_usd_cents: 5926,
    top_size: 'M',
    left_fabric_id: 'f1',
    left_fabric_name_snapshot: 'Sunset Coral',
    left_fabric_hex_snapshot: '#E66B45',
    right_fabric_id: 'f1',
    right_fabric_name_snapshot: 'Sunset Coral',
    right_fabric_hex_snapshot: '#E66B45',
    bottom_style: 'tie-side',
    bottom_coverage: 'bikini',
    bottom_size: 'M',
    bottom_fabric_id: 'f1',
    bottom_fabric_name_snapshot: 'Sunset Coral',
    bottom_fabric_hex_snapshot: '#E66B45',
    full_name: 'Jane Guest',
    email: 'jane@example.com',
    whatsapp: '+14735551234',
    personalization_name: null,
    paid_at: '2026-10-19T01:00:00Z',
    paid_email_sent_at: '2026-10-19T01:05:00Z',
    created_at: '2026-10-19T00:00:00Z',
    updated_at: '2026-10-19T01:05:00Z',
    ...overrides
  }
}

function fakeSupabase(bookingRow, { updateResult } = {}) {
  const updateSpy = vi.fn()
  return {
    _updateSpy: updateSpy,
    from(table) {
      if (table === 'bikini_mix_bookings') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: bookingRow, error: null }) }) }),
          update: (payload) => {
            updateSpy(payload)
            return { eq: () => ({ select: () => Promise.resolve(updateResult ?? { data: [{ id: BOOKING_ID }], error: null }) }) }
          }
        }
      }
      if (table === 'bikini_mix_event') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: {}, error: null }) }) }) }
      }
      throw new Error(`unexpected table ${table}`)
    }
  }
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

async function loadHandler() {
  stubGlobals()
  const mod = await import('../server/api/admin/bikini-mix/bookings/[id]/resend-email.post.js')
  return mod.default
}

describe('POST /api/admin/bikini-mix/bookings/:id/resend-email', () => {
  it('requires admin before doing anything else', async () => {
    const handler = await loadHandler()
    requireAdmin.mockRejectedValue(Object.assign(new Error('unauthorized'), { statusCode: 401 }))
    const supabase = fakeSupabase(confirmedBookingRow({ paid_email_sent_at: null }))
    supabaseAdmin.mockReturnValue(supabase)

    await expect(handler(event())).rejects.toThrow('unauthorized')
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it('sends the confirmation email and bumps paid_email_sent_at on a clean confirmed booking', async () => {
    const handler = await loadHandler()
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    sendTransactionalEmail.mockResolvedValue({ ok: true })
    const supabase = fakeSupabase(confirmedBookingRow({ paid_email_sent_at: null }))
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event())

    expect(res.success).toBe(true)
    expect(res.sentAt).toBeTruthy()
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1)
    expect(supabase._updateSpy).toHaveBeenCalledWith(expect.objectContaining({ paid_email_sent_at: expect.any(String) }))
  })

  it('refuses a pending_payment booking', async () => {
    const handler = await loadHandler()
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = fakeSupabase(confirmedBookingRow({ status: 'pending_payment', paid_at: null, paid_email_sent_at: null }))
    supabaseAdmin.mockReturnValue(supabase)

    const e = event()
    const res = await handler(e)

    expect(e._status).toBe(409)
    expect(res.success).toBe(false)
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it('refuses a paid_needs_review booking — not a real confirmation yet', async () => {
    const handler = await loadHandler()
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = fakeSupabase(confirmedBookingRow({ status: 'paid_needs_review', paid_email_sent_at: null }))
    supabaseAdmin.mockReturnValue(supabase)

    const e = event()
    const res = await handler(e)

    expect(e._status).toBe(409)
    expect(res.success).toBe(false)
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it('refuses a cancelled booking', async () => {
    const handler = await loadHandler()
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = fakeSupabase(confirmedBookingRow({ status: 'cancelled', paid_email_sent_at: null }))
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event())

    expect(res.success).toBe(false)
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it('refuses to resend within the cooldown window — prevents accidental duplicate sends', async () => {
    const handler = await loadHandler()
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    const supabase = fakeSupabase(confirmedBookingRow({ paid_email_sent_at: new Date().toISOString() }))
    supabaseAdmin.mockReturnValue(supabase)

    const e = event()
    const res = await handler(e)

    expect(e._status).toBe(429)
    expect(res.success).toBe(false)
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it('allows resending once the cooldown has elapsed', async () => {
    const handler = await loadHandler()
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    sendTransactionalEmail.mockResolvedValue({ ok: true })
    const longAgo = new Date(Date.now() - 60_000).toISOString()
    const supabase = fakeSupabase(confirmedBookingRow({ paid_email_sent_at: longAgo }))
    supabaseAdmin.mockReturnValue(supabase)

    const res = await handler(event())

    expect(res.success).toBe(true)
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1)
  })

  it('never creates a booking or calls any RPC', async () => {
    const handler = await loadHandler()
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    sendTransactionalEmail.mockResolvedValue({ ok: true })
    const supabase = fakeSupabase(confirmedBookingRow({ paid_email_sent_at: null }))
    supabase.rpc = vi.fn()
    supabaseAdmin.mockReturnValue(supabase)

    await handler(event())

    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('reports a clean failure without updating the timestamp when the send itself fails', async () => {
    const handler = await loadHandler()
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    sendTransactionalEmail.mockResolvedValue({ ok: false, error: 'brevo-down' })
    const supabase = fakeSupabase(confirmedBookingRow({ paid_email_sent_at: null }))
    supabaseAdmin.mockReturnValue(supabase)

    const e = event()
    const res = await handler(e)

    expect(e._status).toBe(502)
    expect(res.success).toBe(false)
    expect(supabase._updateSpy).not.toHaveBeenCalled()
  })
})
