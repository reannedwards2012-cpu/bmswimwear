import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFakeSupabase, hasFilter } from './helpers/fakeSupabase.js'
import { mockFetch } from './helpers/mockFetch.js'
import { maybeSendPaidOrderEmails, buildOrderView } from '../server/utils/paidOrderEmails.js'

const ORDER_ROW = {
  id: 'o1',
  order_number: 7,
  status: 'paid',
  source: 'website',
  first_name: 'Reann',
  last_name: 'Edwards',
  email: 'reann@example.com',
  phone: '+1473',
  delivery_method: 'shipping',
  shipping_address1: '1 Palm Rd',
  shipping_address2: null,
  shipping_city: 'St. George',
  shipping_region: null,
  shipping_postal_code: null,
  shipping_country: 'Grenada',
  subtotal_usd_cents: 24000,
  order_items: [
    { product_name: 'Reef One-Piece', quantity: 2, size: 'M', colour_name: 'Coral', coverage: 'Full' }
  ]
}

// route Brevo calls by tag
const brevo = (opts = {}) =>
  mockFetch((url, body) => {
    const tag = body?.tags?.[0]
    if (tag === 'order-confirmation') return opts.customer ?? { status: 201, json: { messageId: 'c' } }
    if (tag === 'order-admin') return opts.admin ?? { status: 201, json: { messageId: 'a' } }
    return { status: 201, json: {} }
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

describe('maybeSendPaidOrderEmails — happy path', () => {
  it('claims, sends both emails, then finalizes with an ownership-guarded write', async () => {
    const sb = createFakeSupabase([
      { data: [{ id: 'o1' }], error: null }, // claim (unclaimed) wins
      { data: ORDER_ROW, error: null }, // load
      { data: [{ id: 'o1' }], error: null } // finalize
    ])
    const fetchFn = brevo()
    vi.stubGlobal('fetch', fetchFn)

    await maybeSendPaidOrderEmails(sb, 'o1')

    // two Brevo emails
    const tags = fetchFn.records.map((r) => r.body.tags[0])
    expect(tags).toEqual(expect.arrayContaining(['order-confirmation', 'order-admin']))

    // the claim required a paid *website* order not yet sent
    const claim = sb._calls[0]
    expect(claim.op).toBe('update')
    expect(hasFilter(claim, 'eq', 'status', 'paid')).toBe(true)
    expect(hasFilter(claim, 'eq', 'source', 'website')).toBe(true)
    expect(hasFilter(claim, 'is', 'paid_email_sent_at', null)).toBe(true)
    const leaseValue = claim.payload.paid_email_claimed_at
    expect(typeof leaseValue).toBe('string')

    // finalize sets the durable marker + clears the lease, guarded by ownership
    const finalize = sb._calls.find(
      (c) => c.op === 'update' && c.payload && 'paid_email_sent_at' in c.payload
    )
    expect(finalize.payload.paid_email_sent_at).toBeTruthy()
    expect(finalize.payload.paid_email_claimed_at).toBeNull()
    expect(hasFilter(finalize, 'eq', 'paid_email_claimed_at', leaseValue)).toBe(true)
    expect(hasFilter(finalize, 'is', 'paid_email_sent_at', null)).toBe(true)
  })
})

describe('maybeSendPaidOrderEmails — repeated / concurrent callbacks', () => {
  it('does nothing when neither the unclaimed nor the expired-claim update matches', async () => {
    const sb = createFakeSupabase([
      { data: [], error: null }, // claim (unclaimed) — no match (already sent / live lease)
      { data: [], error: null } // expired-claim steal — no match
    ])
    const fetchFn = brevo()
    vi.stubGlobal('fetch', fetchFn)

    await maybeSendPaidOrderEmails(sb, 'o1')

    expect(fetchFn).not.toHaveBeenCalled()
    expect(sb._calls).toHaveLength(2)
    expect(sb._calls.every((c) => c.op === 'update')).toBe(true)
  })
})

describe('maybeSendPaidOrderEmails — customer email fails', () => {
  it('releases the lease (ownership-guarded), never sets paid_email_sent_at, sends no admin mail', async () => {
    const sb = createFakeSupabase([
      { data: [{ id: 'o1' }], error: null }, // claim
      { data: ORDER_ROW, error: null }, // load
      { data: [{ id: 'o1' }], error: null } // release
    ])
    const fetchFn = brevo({ customer: { status: 500, json: { code: 'x' } } })
    vi.stubGlobal('fetch', fetchFn)

    await maybeSendPaidOrderEmails(sb, 'o1')

    // only the customer email was attempted
    expect(fetchFn.records.map((r) => r.body.tags[0])).toEqual(['order-confirmation'])

    const leaseValue = sb._calls[0].payload.paid_email_claimed_at
    const release = sb._calls[2]
    expect(release.op).toBe('update')
    expect(release.payload).toEqual({ paid_email_claimed_at: null })
    expect(hasFilter(release, 'eq', 'paid_email_claimed_at', leaseValue)).toBe(true)
    expect(hasFilter(release, 'is', 'paid_email_sent_at', null)).toBe(true)

    // paid_email_sent_at is never written
    expect(sb._calls.some((c) => c.payload && 'paid_email_sent_at' in c.payload)).toBe(false)
  })
})

describe('maybeSendPaidOrderEmails — admin email fails', () => {
  it('still finalizes the customer confirmation and does not throw', async () => {
    const sb = createFakeSupabase([
      { data: [{ id: 'o1' }], error: null },
      { data: ORDER_ROW, error: null },
      { data: [{ id: 'o1' }], error: null } // finalize
    ])
    vi.stubGlobal('fetch', brevo({ admin: { status: 500, json: { code: 'x' } } }))

    await expect(maybeSendPaidOrderEmails(sb, 'o1')).resolves.toBeUndefined()

    const finalize = sb._calls.find((c) => c.payload && 'paid_email_sent_at' in c.payload)
    expect(finalize.payload.paid_email_sent_at).toBeTruthy()
  })
})

describe('maybeSendPaidOrderEmails — manual / offline orders', () => {
  it('the claim is scoped to source=website, so a manual paid order matches nothing and no mail is sent', async () => {
    // DB returns no rows because the row is source!='website'
    const sb = createFakeSupabase([
      { data: [], error: null },
      { data: [], error: null }
    ])
    const fetchFn = brevo()
    vi.stubGlobal('fetch', fetchFn)

    await maybeSendPaidOrderEmails(sb, 'manual-1')

    expect(fetchFn).not.toHaveBeenCalled()
    expect(hasFilter(sb._calls[0], 'eq', 'source', 'website')).toBe(true)
  })
})

describe('buildOrderView', () => {
  it('maps a DB row to the template view; shipping only for shipping orders', () => {
    const v = buildOrderView(ORDER_ROW)
    expect(v.orderNumber).toBe('BM-000007')
    expect(v.items[0]).toEqual({
      name: 'Reef One-Piece',
      quantity: 2,
      size: 'M',
      colour: 'Coral',
      coverage: 'Full'
    })
    expect(v.shipping).toMatchObject({ address1: '1 Palm Rd', country: 'Grenada' })

    const pickup = buildOrderView({ ...ORDER_ROW, delivery_method: 'pickup' })
    expect(pickup.shipping).toBeNull()
  })
})
