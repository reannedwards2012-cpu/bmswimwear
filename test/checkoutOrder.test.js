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
const CAT = catalogue([entry()])

function payload(over = {}) {
  const { shippingAddress, items, ...rest } = over
  return {
    checkoutId: UUID,
    customer: { firstName: 'Reann', lastName: 'Edwards', email: 'reann@example.com', phone: '4731234567' },
    deliveryMethod: 'international_shipping',
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

const localPayload = (over = {}) =>
  payload({
    deliveryMethod: 'local_delivery',
    shippingAddress: { address1: 'Grand Anse, near the roundabout', country: '', city: '', region: '', postalCode: '' },
    ...over
  })

describe('buildValidatedOrder — Local Delivery', () => {
  it('forces Grenada + Saint George + zone local + $0, total = subtotal', () => {
    const r = buildValidatedOrder(localPayload(), CAT)
    expect(r.ok).toBe(true)
    expect(r.deliveryMethod).toBe('local_delivery')
    expect(r.deliveryZone).toBe('local')
    expect(r.shippingUsdCents).toBe(0)
    expect(r.totalUsdCents).toBe(r.subtotalUsdCents)
    expect(r.billableWeightLb).toBeNull()
    expect(r.orderRow.delivery_method).toBe('shipping') // stored value unchanged
    expect(r.orderRow.shipping_zone).toBe('local')
    expect(r.orderRow.shipping_country).toBe('Grenada')
    expect(r.orderRow.shipping_region).toBe('Saint George')
    expect(r.orderRow.shipping_address1).toBe('Grand Anse, near the roundabout')
    expect(r.orderRow.shipping_city).toBeNull()
    expect(r.orderRow.shipping_postal_code).toBeNull()
  })

  it('requires the delivery area field', () => {
    const r = buildValidatedOrder(localPayload({ shippingAddress: { address1: '' } }), CAT)
    expect(r.ok).toBe(false)
  })

  it('ignores any client-sent country / region / postal for local delivery', () => {
    const r = buildValidatedOrder(
      localPayload({
        shippingAddress: {
          address1: 'St Pauls',
          country: 'Australia',
          region: 'Saint Andrew',
          postalCode: 'ZZZ',
          city: 'Sydney'
        }
      }),
      CAT
    )
    expect(r.ok).toBe(true)
    expect(r.deliveryZone).toBe('local')
    expect(r.shippingUsdCents).toBe(0)
    expect(r.orderRow.shipping_country).toBe('Grenada')
    expect(r.orderRow.shipping_region).toBe('Saint George')
  })
})

describe('buildValidatedOrder — International Shipping', () => {
  it('USA → international shipping, total = subtotal + authoritative shipping', () => {
    const r = buildValidatedOrder(payload(), CAT)
    expect(r.ok).toBe(true)
    expect(r.deliveryMethod).toBe('international_shipping')
    expect(r.deliveryZone).toBe('usa')
    expect(r.billableWeightLb).toBe(1)
    expect(r.shippingUsdCents).toBe(internationalShippingUsdCents('usa', 1))
    expect(r.totalUsdCents).toBe(r.subtotalUsdCents + r.shippingUsdCents)
    expect(r.orderRow.shipping_zone).toBe('usa')
    expect(r.orderRow.total_usd_cents).toBe(r.totalUsdCents)
  })

  it('quantity increases billable weight → higher total', () => {
    const one = buildValidatedOrder(payload({ items: [{ productId: 'reef-one-piece', quantity: 1 }] }), CAT)
    const three = buildValidatedOrder(payload({ items: [{ productId: 'reef-one-piece', quantity: 3 }] }), CAT)
    expect(three.billableWeightLb).toBeGreaterThan(one.billableWeightLb)
    expect(three.shippingUsdCents).toBeGreaterThan(one.shippingUsdCents)
  })

  it('rejects Grenada as an international destination (points at Local Delivery)', () => {
    const r = buildValidatedOrder(payload({ shippingAddress: { country: 'Grenada' } }), CAT)
    expect(r.ok).toBe(false)
    expect(r.issues.join(' ')).toMatch(/Local Delivery/i)
  })

  it('unsupported country → rejected, no order/Go2Pay', () => {
    const r = buildValidatedOrder(payload({ shippingAddress: { country: 'Australia' } }), CAT)
    expect(r.ok).toBe(false)
    expect(r.code).toBe('unsupported_destination')
  })

  it('unknown product category → weight_config, no order', () => {
    const r = buildValidatedOrder(payload(), catalogue([entry({ category: 'Sarongs' })]))
    expect(r.ok).toBe(false)
    expect(r.code).toBe('weight_config')
  })

  it('missing country / address / city → rejected', () => {
    expect(buildValidatedOrder(payload({ shippingAddress: { country: '' } }), CAT).ok).toBe(false)
    expect(buildValidatedOrder(payload({ shippingAddress: { address1: '' } }), CAT).ok).toBe(false)
    expect(buildValidatedOrder(payload({ shippingAddress: { city: '' } }), CAT).ok).toBe(false)
  })
})

describe('buildValidatedOrder — switching method recalculates', () => {
  it('same cart: Local Delivery total < International total (International adds shipping)', () => {
    const local = buildValidatedOrder(localPayload(), CAT)
    const intl = buildValidatedOrder(payload(), CAT)
    expect(local.subtotalUsdCents).toBe(intl.subtotalUsdCents)
    expect(local.totalUsdCents).toBe(local.subtotalUsdCents)
    expect(intl.totalUsdCents).toBe(intl.subtotalUsdCents + intl.shippingUsdCents)
    expect(intl.totalUsdCents).toBeGreaterThan(local.totalUsdCents)
  })
})

describe('buildValidatedOrder — the browser is never trusted', () => {
  it('ignores client-supplied weight / shipping / total / subtotal', () => {
    const r = buildValidatedOrder(
      payload({ weight: 0.01, shippingUsd: 0.5, shippingUsdCents: 1, totalUsd: 1, totalUsdCents: 1, subtotalUsd: 1 }),
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
