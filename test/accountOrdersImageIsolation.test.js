import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Phase 2 security hardening — GET /api/account/orders is the one place a
 * CUSTOMER (not an admin) can ever reach order data. It must never expose
 * a custom item's reference/design image, regardless of bucket privacy —
 * this is the concrete proof that "a customer cannot retrieve another
 * customer's image, or even their own custom-order reference image" holds
 * for the only customer-facing surface that touches this table.
 */

vi.mock('../server/utils/authUser.js', () => ({ requireUser: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))
vi.mock('../server/utils/claimGuestOrders.js', () => ({ claimGuestOrdersForUser: vi.fn(async () => {}) }))

import { requireUser } from '../server/utils/authUser.js'
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('setResponseStatus', (e, s) => { e._status = s })
}
const event = () => ({ _status: 200 })

function fakeSupabase(rows) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ order: () => Promise.resolve({ data: rows, error: null }) })
      })
    })
  }
}

let handler

beforeEach(async () => {
  stubGlobals()
  requireUser.mockReset().mockResolvedValue({ id: 'user-1', email: 'jane@example.com', emailVerified: true })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  handler = (await import('../server/api/account/orders.get.js')).default
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("GET /api/account/orders — a customer's own custom-order image is still never exposed", () => {
  it('nulls image for a custom item even though it is this exact customer\'s own order', async () => {
    const rows = [{
      order_number: 1, created_at: '2026-01-01', status: 'paid', currency: 'USD',
      order_items: [{ product_name: 'Custom bikini', image: 'https://proj.supabase.co/storage/v1/object/public/order-images/mine.jpg', is_custom: true, quantity: 1 }]
    }]
    supabaseAdmin.mockReturnValue(fakeSupabase(rows))

    const res = await handler(event())
    expect(res.orders[0].items[0].image).toBeNull()
  })

  it('still exposes a non-custom (catalogue) item\'s image — unrelated to the sensitive bucket', async () => {
    const rows = [{
      order_number: 1, created_at: '2026-01-01', status: 'paid', currency: 'USD',
      order_items: [{ product_name: 'Catalogue top', image: 'https://proj.supabase.co/storage/v1/object/public/products/catalogue.jpg', is_custom: false, quantity: 1 }]
    }]
    supabaseAdmin.mockReturnValue(fakeSupabase(rows))

    const res = await handler(event())
    expect(res.orders[0].items[0].image).toBe('https://proj.supabase.co/storage/v1/object/public/products/catalogue.jpg')
  })
})
