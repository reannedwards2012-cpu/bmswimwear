import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('../server/utils/brevo.js', () => ({ sendTransactionalEmail: vi.fn() }))
vi.mock('../server/utils/siteUrl.js', () => ({ siteUrl: () => 'https://bmswimwear.com' }))

import { sendTransactionalEmail } from '../server/utils/brevo.js'
import { maybeSendBikiniMixBookingEmails } from '../server/utils/bikiniMixBookingEmails.js'

function bookingDetailRow(overrides = {}) {
  return {
    id: 'bkg-1',
    booking_number: 7,
    status: 'confirmed',
    hold_expires_at: null,
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
    marketing_opt_in: false,
    terms_accepted_at: '2026-10-19T00:00:00Z',
    payment_provider: 'go2pay',
    go2pay_order_id: 'go-1',
    payment_id: 'pay_123',
    paid_at: '2026-10-19T01:00:00Z',
    admin_notes: null,
    created_at: '2026-10-19T00:00:00Z',
    updated_at: '2026-10-19T01:00:00Z',
    ...overrides
  }
}

/** Minimal fake supabase supporting exactly the chain shapes this module uses. */
function fakeSupabase({ claimResult, bookingRow, eventRow }) {
  let claimCallCount = 0
  const bikiniMixBookingsUpdate = vi.fn()
  const finalizeCall = vi.fn()

  return {
    _finalizeCall: finalizeCall,
    _bikiniMixBookingsUpdate: bikiniMixBookingsUpdate,
    from(table) {
      if (table === 'bikini_mix_bookings') {
        const chain = {
          _filters: [],
          update(payload) {
            chain._payload = payload
            return chain
          },
          select() {
            return chain
          },
          eq(k, v) {
            chain._filters.push(['eq', k, v])
            return chain
          },
          is(k, v) {
            chain._filters.push(['is', k, v])
            return chain
          },
          lt(k, v) {
            chain._filters.push(['lt', k, v])
            return chain
          },
          not(k, op, v) {
            chain._filters.push(['not', k, op, v])
            return chain
          },
          maybeSingle() {
            return Promise.resolve({ data: bookingRow, error: null })
          },
          then(onFulfilled) {
            // UPDATE ... .select('id') resolves via `then` in this fake.
            claimCallCount += 1
            bikiniMixBookingsUpdate(chain._payload, chain._filters)
            const isClaimed = chain._payload && 'paid_email_claimed_at' in chain._payload && chain._payload.paid_email_claimed_at !== null
            const isFinalize = chain._payload && chain._payload.paid_email_sent_at
            const isRelease = chain._payload && 'paid_email_claimed_at' in chain._payload && chain._payload.paid_email_claimed_at === null && !isFinalize
            if (isFinalize) finalizeCall(chain._payload)
            const result = claimResult(claimCallCount, { isClaimed, isFinalize, isRelease })
            return Promise.resolve(result).then(onFulfilled)
          }
        }
        return chain
      }
      if (table === 'bikini_mix_event') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: eventRow, error: null }) }) })
        }
      }
      throw new Error(`unexpected table ${table}`)
    }
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('maybeSendBikiniMixBookingEmails', () => {
  it('claims, sends, and finalizes exactly once on a clean run', async () => {
    sendTransactionalEmail.mockResolvedValue({ ok: true })
    const supabase = fakeSupabase({
      claimResult: (n) => (n === 1 ? { data: [{ id: 'bkg-1' }], error: null } : { data: [{ id: 'bkg-1' }], error: null }),
      bookingRow: bookingDetailRow(),
      eventRow: { event_name: 'The Bikini Mixer', event_date: '2026-12-12', venue: 'The Closet, Grenada' }
    })

    await maybeSendBikiniMixBookingEmails(supabase, 'bkg-1')

    expect(sendTransactionalEmail).toHaveBeenCalledTimes(2) // customer + admin
    expect(supabase._finalizeCall).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the claim matches no row (already sent or held by another worker)', async () => {
    const supabase = fakeSupabase({
      claimResult: () => ({ data: [], error: null }),
      bookingRow: bookingDetailRow(),
      eventRow: {}
    })

    await maybeSendBikiniMixBookingEmails(supabase, 'bkg-1')

    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it('releases the lease and does not finalize when the customer email fails to send', async () => {
    sendTransactionalEmail.mockResolvedValue({ ok: false, error: 'brevo-down' })
    const supabase = fakeSupabase({
      claimResult: (n) => ({ data: [{ id: 'bkg-1' }], error: null }),
      bookingRow: bookingDetailRow(),
      eventRow: {}
    })

    await maybeSendBikiniMixBookingEmails(supabase, 'bkg-1')

    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1) // customer attempt only, no admin email on failure
    expect(supabase._finalizeCall).not.toHaveBeenCalled()
  })

  it('sends the needs-review variant when status is paid_needs_review', async () => {
    sendTransactionalEmail.mockResolvedValue({ ok: true })
    const supabase = fakeSupabase({
      claimResult: () => ({ data: [{ id: 'bkg-1' }], error: null }),
      bookingRow: bookingDetailRow({ status: 'paid_needs_review' }),
      eventRow: {}
    })

    await maybeSendBikiniMixBookingEmails(supabase, 'bkg-1')

    const [customerCallArgs] = sendTransactionalEmail.mock.calls
    expect(customerCallArgs[0].subject).toMatch(/payment is received/i)
  })
})
