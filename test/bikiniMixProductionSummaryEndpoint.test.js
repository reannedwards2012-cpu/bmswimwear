import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../server/utils/authUser.js', () => ({ requireAdmin: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))

import { requireAdmin } from '../server/utils/authUser.js'
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('setResponseStatus', (e, s) => { e._status = s })
}
const event = () => ({ _status: 200 })

function rowBase(overrides = {}) {
  return {
    id: 'bk-1',
    booking_number: 1,
    full_name: 'Jane Guest',
    package: 'ticket',
    garment_type: 'bikini',
    bottom_scrunch: false,
    top_size: 'M',
    left_fabric_name_snapshot: 'Royal Blue',
    right_fabric_name_snapshot: 'Royal Blue',
    bottom_style: 'tie-side',
    bottom_coverage: 'bikini',
    bottom_size: 'M',
    bottom_fabric_name_snapshot: 'Royal Blue',
    onepiece_size: null,
    onepiece_coverage: null,
    onepiece_fabric_name_snapshot: null,
    early_bird_applied: false,
    is_complimentary: false,
    invitation_category: null,
    base_prepared_at: null,
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
  return (await import('../server/api/admin/bikini-mix/production-summary.get.js')).default
}

describe('GET /api/admin/bikini-mix/production-summary', () => {
  it('includes a complimentary booking in the overall count and cutting groups, labeled distinctly', async () => {
    const rows = [
      rowBase({ id: 'bk-1' }),
      rowBase({ id: 'bk-2', is_complimentary: true, invitation_category: 'giveaway' })
    ]
    supabaseAdmin.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }) })
    const handler = await loadHandler()

    const res = await handler(event())

    // Both rows (paid + complimentary) count toward the real participant total.
    expect(res.confirmedCount).toBe(2)
    expect(res.bookings.find((b) => b.id === 'bk-2')).toMatchObject({ isComplimentary: true, ticketTier: 'Complimentary (Giveaway)' })
    expect(res.bookings.find((b) => b.id === 'bk-1')).toMatchObject({ isComplimentary: false, ticketTier: 'Regular' })
    // Both garment selections still contribute to the same left-triangle cutting group.
    expect(res.leftTriangles.reduce((sum, g) => sum + g.count, 0)).toBe(2)
  })
})
