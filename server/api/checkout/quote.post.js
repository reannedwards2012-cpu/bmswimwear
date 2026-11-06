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
 *
 * Abuse protection: rate limit ONLY (hashed-IP, server/utils/checkoutRateLimit.js).
 * No honeypot and no Turnstile here, deliberately: this is called on every
 * debounced cart/address edit on the checkout page (no form submission, no
 * hidden field a bot would fill), has no side effects (no row written, no
 * Go2Pay request), and a Turnstile token is single-use — requiring one on
 * every keystroke-driven call would break the live quote entirely. The real
 * gates (honeypot + Turnstile) are on server/api/checkout.post.js, which is
 * the only endpoint that actually creates anything.
 */
import { supabaseAdmin } from '../../utils/supabaseAdmin.js'
import { fetchCatalogueForCheckout } from '../../utils/productCatalogue.js'
import { resolveDelivery } from '../../utils/shipping.js'
import { resolveClientIp, ipHash } from '../../utils/inquiryRateLimit.js'
import { checkRateLimit, recordRateHit } from '../../utils/checkoutRateLimit.js'

const RATE_SCOPE = 'checkout-quote'
const RATE_WINDOW_MINUTES = 5
const RATE_MAX_PER_WINDOW = 200 // generous — legitimate use calls this on every debounced field edit (cart edits + address changes can add up quickly on one checkout session)

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null)
  const b = body && typeof body === 'object' ? body : {}

  const supabase = supabaseAdmin()
  const ipHashValue = ipHash(resolveClientIp(event))
  const gate = await checkRateLimit(supabase, {
    scope: RATE_SCOPE,
    keyHash: ipHashValue,
    windowMinutes: RATE_WINDOW_MINUTES,
    maxPerWindow: RATE_MAX_PER_WINDOW
  })
  if (!gate.ok) {
    setResponseStatus(event, 429)
    setResponseHeader(event, 'Retry-After', String(gate.retryAfterSeconds))
    return { ok: false, code: 'rate_limited', error: 'Too many requests — please wait a moment.' }
  }
  await recordRateHit(supabase, { scope: RATE_SCOPE, keyHash: ipHashValue })

  // Local delivery is authoritatively Grenada / Saint George — the client's
  // country/region are ignored for that method (mirrors buildValidatedOrder).
  const isLocal = (typeof b.deliveryMethod === 'string' ? b.deliveryMethod : '') === 'local_delivery'
  const country = isLocal ? 'Grenada' : typeof b.country === 'string' ? b.country.trim() : ''
  const region = isLocal ? 'Saint George' : typeof b.region === 'string' ? b.region.trim() : ''

  const wanted = (Array.isArray(b.items) ? b.items : [])
    .map((i) => ({
      productId: i && typeof i.productId === 'string' ? i.productId : null,
      quantity: Number(i && i.quantity)
    }))
    .filter((i) => i.productId && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 99)

  if (!isLocal && !country) return { ok: false, code: 'no_country', error: 'Select a delivery country.' }
  if (wanted.length === 0) return { ok: false, code: 'empty', error: 'Your cart is empty.' }

  let catalogue
  try {
    catalogue = await fetchCatalogueForCheckout(
      supabase,
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
