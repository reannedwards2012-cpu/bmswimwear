/**
 * POST /api/checkout/quote   (public — no auth)
 *
 * DISPLAY ONLY. Given the cart + destination it returns the subtotal, shipping
 * and total the customer would pay, plus the delivery method — so the checkout
 * summary shows real numbers and destination problems (wrong parish,
 * unsupported country) BEFORE the customer submits.
 *
 * It creates no order and no Go2Pay request. The authoritative checkout
 * endpoint (server/api/checkout.post.js) independently recomputes everything
 * from the live catalogue + server-side shipping engine and never trusts this
 * response or anything else from the browser.
 */
import { supabaseAdmin } from '../../utils/supabaseAdmin.js'
import { fetchCatalogueForCheckout } from '../../utils/productCatalogue.js'
import { resolveDelivery } from '../../utils/shipping.js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null)
  const b = body && typeof body === 'object' ? body : {}

  const country = typeof b.country === 'string' ? b.country.trim() : ''
  const region = typeof b.region === 'string' ? b.region.trim() : ''

  const wanted = (Array.isArray(b.items) ? b.items : [])
    .map((i) => ({
      productId: i && typeof i.productId === 'string' ? i.productId : null,
      quantity: Number(i && i.quantity)
    }))
    .filter((i) => i.productId && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 99)

  if (!country) return { ok: false, code: 'no_country', error: 'Select a delivery country.' }
  if (wanted.length === 0) return { ok: false, code: 'empty', error: 'Your cart is empty.' }

  let catalogue
  try {
    catalogue = await fetchCatalogueForCheckout(
      supabaseAdmin(),
      wanted.map((i) => i.productId)
    )
  } catch (err) {
    console.error('[checkout/quote] catalogue fetch failed:', err?.message)
    setResponseStatus(event, 500)
    return { ok: false, code: 'server', error: 'We couldn’t calculate shipping right now. Please try again.' }
  }

  let subtotalUsdCents = 0
  const deliveryItems = []
  for (const w of wanted) {
    const p = catalogue.get(w.productId)
    if (!p) return { ok: false, code: 'item', error: 'One of your items is no longer available.' }
    subtotalUsdCents += Math.round(p.price * 100) * w.quantity
    deliveryItems.push({ category: p.category, quantity: w.quantity })
  }

  const delivery = resolveDelivery({ country, region, items: deliveryItems })
  if (!delivery.ok) {
    if (delivery.code === 'weight_config') {
      console.error('[checkout/quote] weight config problem:', delivery.detail)
    }
    return { ok: false, code: delivery.code, error: delivery.error }
  }

  return {
    ok: true,
    method: delivery.method, // 'local_delivery' | 'international_shipping'
    zone: delivery.zone,
    billableWeightLb: delivery.billableWeightLb,
    subtotalUsdCents,
    shippingUsdCents: delivery.shippingUsdCents,
    totalUsdCents: subtotalUsdCents + delivery.shippingUsdCents
  }
})
