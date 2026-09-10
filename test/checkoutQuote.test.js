import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { internationalShippingUsdCents } from '../server/utils/shipping.js'

vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: () => ({}) }))
vi.mock('../server/utils/productCatalogue.js', () => ({ fetchCatalogueForCheckout: vi.fn() }))
import { fetchCatalogueForCheckout } from '../server/utils/productCatalogue.js'

async function loadHandler() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('readBody', async (e) => e._body)
  vi.stubGlobal('setResponseStatus', (e, s) => {
    e._status = s
  })
  vi.resetModules()
  return (await import('../server/api/checkout/quote.post.js')).default
}

const ev = (body) => ({ _body: body, _status: 200 })
const CAT = new Map([['reef', { price: 120, category: 'One Pieces' }]])
const items = [{ productId: 'reef', quantity: 1 }]

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  fetchCatalogueForCheckout.mockResolvedValue(CAT)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('POST /api/checkout/quote', () => {
  it('local_delivery → local, $0 shipping, total = subtotal (client country/region ignored)', async () => {
    const handler = await loadHandler()
    const res = await handler(ev({ deliveryMethod: 'local_delivery', country: 'Australia', region: 'x', items }))
    expect(res).toMatchObject({
      ok: true,
      method: 'local_delivery',
      subtotalUsdCents: 12000,
      shippingUsdCents: 0,
      totalUsdCents: 12000
    })
  })

  it('international → shipping computed, total = subtotal + shipping', async () => {
    const handler = await loadHandler()
    const res = await handler(ev({ deliveryMethod: 'international_shipping', country: 'United States', region: 'FL', items }))
    expect(res.ok).toBe(true)
    expect(res.shippingUsdCents).toBe(internationalShippingUsdCents('usa', 1))
    expect(res.totalUsdCents).toBe(12000 + res.shippingUsdCents)
  })

  it('unsupported country → ok:false with the contact-us message', async () => {
    const handler = await loadHandler()
    const res = await handler(ev({ deliveryMethod: 'international_shipping', country: 'Australia', region: '', items }))
    expect(res.ok).toBe(false)
    expect(res.code).toBe('unsupported_destination')
  })

  it('international with no country → ok:false', async () => {
    const handler = await loadHandler()
    expect((await handler(ev({ deliveryMethod: 'international_shipping', country: '', items }))).code).toBe('no_country')
  })

  it('empty cart → ok:false', async () => {
    const handler = await loadHandler()
    expect((await handler(ev({ deliveryMethod: 'local_delivery', items: [] }))).code).toBe('empty')
  })

  it('item not in the live catalogue → ok:false', async () => {
    const handler = await loadHandler()
    const res = await handler(
      ev({ deliveryMethod: 'international_shipping', country: 'United States', items: [{ productId: 'ghost', quantity: 1 }] })
    )
    expect(res.ok).toBe(false)
    expect(res.code).toBe('item')
  })
})
