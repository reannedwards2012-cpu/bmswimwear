import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../server/utils/authUser.js', () => ({ requireAdmin: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))

import { requireAdmin } from '../server/utils/authUser.js'
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('setResponseStatus', (e, s) => { e._status = s })
  vi.stubGlobal('setResponseHeaders', (e, h) => { e._headers = h })
}
const event = () => ({ _status: 200 })

function rowBase(overrides = {}) {
  return {
    booking_number: 1,
    full_name: 'Jane Guest',
    email: 'jane@example.com',
    whatsapp: '+14735551234',
    package: 'ticket',
    garment_type: 'bikini',
    early_bird_applied: false,
    is_complimentary: false,
    invitation_category: null,
    top_size: 'M',
    left_fabric_name_snapshot: 'Royal Blue',
    right_fabric_name_snapshot: 'Royal Blue',
    bottom_size: 'M',
    bottom_fabric_name_snapshot: 'Royal Blue',
    bottom_style: 'tie-side',
    bottom_coverage: 'bikini',
    bottom_scrunch: false,
    onepiece_size: null,
    onepiece_coverage: null,
    onepiece_fabric_name_snapshot: null,
    personalization_name: null,
    bust_inches: null,
    underbust_inches: null,
    waist_inches: null,
    hips_inches: null,
    charged_usd_cents: 8333,
    created_at: '2026-11-01T00:00:00Z',
    ...overrides
  }
}

beforeEach(() => {
  stubGlobals()
  requireAdmin.mockReset().mockResolvedValue({ id: 'admin-1' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function loadHandler() {
  return (await import('../server/api/admin/bikini-mix/bookings/export.get.js')).default
}

describe('GET /api/admin/bikini-mix/bookings/export', () => {
  it('labels a complimentary row with its category, and leaves "Amount Paid" blank for it', async () => {
    const rows = [rowBase({ is_complimentary: true, invitation_category: 'event_assistant', charged_usd_cents: null })]
    supabaseAdmin.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }) })
    const handler = await loadHandler()

    const csv = await handler(event())

    expect(csv).toContain('Complimentary (Event Assistant)')
    const dataLine = csv.split('\r\n')[1]
    const amountPaidCol = dataLine.split(',').at(-2) // "Amount Paid (USD)" is second-to-last column
    expect(amountPaidCol).toBe('')
  })

  it('a normal paid row still shows Early Bird/Regular and its real amount', async () => {
    const rows = [rowBase({ early_bird_applied: true, charged_usd_cents: 8333 })]
    supabaseAdmin.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }) })
    const handler = await loadHandler()

    const csv = await handler(event())

    expect(csv).toContain('Early Bird')
    expect(csv).toContain('83.33')
  })
})
