import { describe, it, expect } from 'vitest'
import { buildValidatedOrder } from '../server/utils/checkoutOrder.js'
import { internationalShippingUsdCents } from '../server/utils/shipping.js'

const UUID = '11111111-1111-4111-8111-111111111111'

// Minimal authoritative catalogue entry (see server/utils/productCatalogue.js).
function entry(over = {}) {
  return {
    id: over.id || 'reef-one-piece',
    title: over.title || 'Reef One-Piece',
    category: over.category || 'One Pieces',
    image: 'x.jpg',
    price: over.price ?? 120,
    priceXcd: over.priceXcd ?? 324,
    sizes: over.sizes ?? [],
    coverage: over.coverage ?? [],
    colours: over.colours ?? []
  }
}
const catalogue = (entries) => new Map(entries.map((e) => [e.id, e]))

function payload(over = {}) {
  const { shippingAddress, items, ...rest } = over
  return {
    checkoutId: UUID,
    customer: { firstName: 'Reann', lastName: 'Edwards', email: 'reann@example.com', phone: '4731234567' },
    shippingAddress: {
      country: 'United States',
      address1: '1 Palm Rd',
      address2: '',
      city: 'Miami',
      region: 'FL',
      postalCode: '33101',
      ...shippingAddress
    },
    notes: '',
    items: items || [{ productId: 'reef-one-piece', quantity: 1 }],
    ...rest
  }
}

const CAT = catalogue([entry()])

describe('buildValidatedOrder — Grenada local delivery', () => {
  it('Saint George → local delivery, $0 shipping, total = subtotal, zone "local"', () => {
    const r = buildValidatedOrder(
      payload({ shippingAddress: { country: 'Grenada', region: 'Saint George', address1: '1 Lagoon Rd', city: 'St George' } }),
      CAT
    )
    expect(r.ok).toBe(true)
    expect(r.subtotalUsdCents).toBe(12000)
    expect(r.shippingUsdCents).toBe(0)
    expect(r.totalUsdCents).toBe(12000)
    expect(r.deliveryZone).toBe('local')
    expect(r.deliveryMethod).toBe('local_delivery')
    expect(r.billableWeightLb).toBeNull()
    expect(r.orderRow.delivery_method).toBe('shipping') // stored value unchanged
    expect(r.orderRow.shipping_zone).toBe('local')
    expect(r.orderRow.shipping_usd_cents).toBe(0)
    expect(r.orderRow.total_usd_cents).toBe(12000)
    expect(r.orderRow.billable_weight_lb).toBeNull()
    expect(r.orderRow.shipping_country).toBe('Grenada')
  })

  it('Grenada, wrong parish → rejected, no order', () => {
    const r = buildValidatedOrder(
      payload({ shippingAddress: { country: 'Grenada', region: 'Saint David', address1: 'x', city: 'y' } }),
      CAT
    )
    expect(r.ok).toBe(false)
    expect(r.code).toBe('grenada_parish')
  })

  it('Grenada, missing parish → rejected at field validation', () => {
    const r = buildValidatedOrder(
      payload({ shippingAddress: { country: 'Grenada', region: '', address1: 'x', city: 'y' } }),
      CAT
    )
    expect(r.ok).toBe(false)
  })
})

describe('buildValidatedOrder — international', () => {
  it('USA → international shipping, total = subtotal + shipping', () => {
    const r = buildValidatedOrder(payload(), CAT)
    expect(r.ok).toBe(true)
    expect(r.deliveryZone).toBe('usa')
    expect(r.deliveryMethod).toBe('international_shipping')
    expect(r.billableWeightLb).toBe(1)
    expect(r.shippingUsdCents).toBe(internationalShippingUsdCents('usa', 1))
    expect(r.totalUsdCents).toBe(r.subtotalUsdCents + r.shippingUsdCents)
    expect(r.orderRow.total_usd_cents).toBe(r.totalUsdCents)
    expect(r.orderRow.shipping_zone).toBe('usa')
    expect(r.orderRow.billable_weight_lb).toBe(1)
  })

  it('quantity increases billable weight → higher total', () => {
    const one = buildValidatedOrder(payload({ items: [{ productId: 'reef-one-piece', quantity: 1 }] }), CAT)
    const three = buildValidatedOrder(payload({ items: [{ productId: 'reef-one-piece', quantity: 3 }] }), CAT)
    expect(one.billableWeightLb).toBe(1)
    expect(three.billableWeightLb).toBe(2)
    expect(three.shippingUsdCents).toBeGreaterThan(one.shippingUsdCents)
  })

  it('unsupported country → rejected, no order/Go2Pay', () => {
    const r = buildValidatedOrder(payload({ shippingAddress: { country: 'Australia' } }), CAT)
    expect(r.ok).toBe(false)
    expect(r.code).toBe('unsupported_destination')
  })

  it('"Other" → rejected', () => {
    const r = buildValidatedOrder(payload({ shippingAddress: { country: 'Other' } }), CAT)
    expect(r.ok).toBe(false)
    expect(r.code).toBe('unsupported_destination')
  })

  it('unknown product category → weight_config, no order', () => {
    const r = buildValidatedOrder(payload(), catalogue([entry({ category: 'Sarongs' })]))
    expect(r.ok).toBe(false)
    expect(r.code).toBe('weight_config')
  })
})

describe('buildValidatedOrder — the browser is never trusted', () => {
  it('ignores client-supplied weight / shipping / total / subtotal', () => {
    const r = buildValidatedOrder(
      payload({
        weight: 0.01,
        shippingUsd: 0.5,
        shippingUsdCents: 1,
        totalUsd: 1,
        totalUsdCents: 1,
        subtotalUsd: 1
      }),
      CAT
    )
    expect(r.ok).toBe(true)
    expect(r.subtotalUsdCents).toBe(12000) // from the catalogue, not the payload
    expect(r.shippingUsdCents).toBe(internationalShippingUsdCents('usa', 1))
    expect(r.totalUsdCents).toBe(12000 + r.shippingUsdCents)
  })

  it('unit price comes from the catalogue, not the cart item', () => {
    const r = buildValidatedOrder(
      payload({ items: [{ productId: 'reef-one-piece', quantity: 1, priceUsd: 1 }] }),
      CAT
    )
    expect(r.itemRows[0].unit_price_usd_cents).toBe(12000)
  })
})

describe('buildValidatedOrder — marketing opt-in (persisted on the order)', () => {
  it('true only when marketingOptIn === true — persisted to orderRow.marketing_opt_in', () => {
    const r = buildValidatedOrder(payload({ marketingOptIn: true }), CAT)
    expect(r.marketingOptIn).toBe(true)
    expect(r.orderRow.marketing_opt_in).toBe(true)
  })
  it.each([undefined, false, 'true', 1, null])('%p → not opted in (default false)', (v) => {
    const r = buildValidatedOrder(payload({ marketingOptIn: v }), CAT)
    expect(r.marketingOptIn).toBe(false)
    expect(r.orderRow.marketing_opt_in).toBe(false)
  })
})
