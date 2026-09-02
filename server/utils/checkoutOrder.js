/**
 * Server-side checkout validation + authoritative order building.
 *
 * Pure module (no Nitro/Supabase imports) so it can be unit-tested directly.
 * NOTHING from the client payload is trusted for money, names or images — every
 * stored value is looked up from the catalogue in data/products.js, which holds
 * the single source of truth for each product's USD/XCD price.
 */
import { getProductById } from '../../data/products.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const MAX = {
  name: 120,
  email: 200,
  phone: 40,
  country: 80,
  address: 200,
  city: 120,
  region: 120,
  postal: 32,
  notes: 2000
}

const MAX_QTY = 99

const str = (v) => (typeof v === 'string' ? v.trim() : '')
// Catalogue prices are exact 2dp dollar values derived from integer cents,
// so this round-trips losslessly back to integer cents.
const toCents = (dollars) => Math.round(dollars * 100)

/**
 * @returns {{ ok: false, error: string, issues: string[] }}
 *        | {{ ok: true, orderRow: object, itemRows: object[], subtotalUsdCents: number }}
 */
export function buildValidatedOrder(payload) {
  const issues = []
  const p = payload && typeof payload === 'object' ? payload : {}

  // ── customer ──────────────────────────────────────────
  const c = p.customer && typeof p.customer === 'object' ? p.customer : {}
  const firstName = str(c.firstName)
  const lastName = str(c.lastName)
  const email = str(c.email)
  const phone = str(c.phone)

  if (!firstName) issues.push('Enter a first name.')
  if (!lastName) issues.push('Enter a last name.')
  if (!email || !EMAIL_RE.test(email)) issues.push('Enter a valid email address.')
  if (!phone || phone.replace(/\D/g, '').length < 7) issues.push('Enter a valid phone number.')
  if (
    firstName.length > MAX.name ||
    lastName.length > MAX.name ||
    email.length > MAX.email ||
    phone.length > MAX.phone
  ) {
    issues.push('One or more contact fields are too long.')
  }

  // ── delivery method ───────────────────────────────────
  const deliveryMethod = str(p.deliveryMethod)
  if (deliveryMethod !== 'pickup' && deliveryMethod !== 'shipping') {
    issues.push('Choose a valid delivery method.')
  }

  // ── shipping address (null unless shipping) ───────────
  let shipping = {
    shipping_country: null,
    shipping_address1: null,
    shipping_address2: null,
    shipping_city: null,
    shipping_region: null,
    shipping_postal_code: null
  }

  if (deliveryMethod === 'shipping') {
    const a = p.shippingAddress && typeof p.shippingAddress === 'object' ? p.shippingAddress : {}
    const country = str(a.country)
    const address1 = str(a.address1)
    const address2 = str(a.address2)
    const city = str(a.city)
    const region = str(a.region)
    const postalCode = str(a.postalCode)

    if (!country) issues.push('Select a country.')
    if (!address1) issues.push('Enter an address.')
    if (!city) issues.push('Enter a city or town.')
    if (
      country.length > MAX.country ||
      address1.length > MAX.address ||
      address2.length > MAX.address ||
      city.length > MAX.city ||
      region.length > MAX.region ||
      postalCode.length > MAX.postal
    ) {
      issues.push('One or more address fields are too long.')
    }

    shipping = {
      shipping_country: country || null,
      shipping_address1: address1 || null,
      shipping_address2: address2 || null,
      shipping_city: city || null,
      shipping_region: region || null,
      shipping_postal_code: postalCode || null
    }
  }

  // ── notes ─────────────────────────────────────────────
  let notes = str(p.notes)
  if (notes.length > MAX.notes) issues.push('Order notes are too long.')
  notes = notes || null

  // ── items (validated + merged against the catalogue) ──
  const rawItems = Array.isArray(p.items) ? p.items : []
  if (rawItems.length === 0) issues.push('Your cart has no items.')

  const merged = new Map()

  for (const raw of rawItems) {
    const item = raw && typeof raw === 'object' ? raw : {}
    const productId = str(item.productId)
    const size = item.size == null ? null : str(item.size) || null
    const colourId = item.colourId == null ? null : str(item.colourId) || null
    const coverage = item.coverage == null ? null : str(item.coverage) || null
    const quantity = typeof item.quantity === 'number' ? item.quantity : Number(item.quantity)

    if (!productId) {
      issues.push('A cart item is missing its product.')
      continue
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) {
      issues.push(`Invalid quantity for "${productId}".`)
      continue
    }

    const product = getProductById(productId)
    if (!product) {
      issues.push(`"${productId}" is not an available product.`)
      continue
    }

    const label = product.title

    // size
    if (product.sizes.length > 0) {
      if (!size) issues.push(`Select a size for ${label}.`)
      else if (!product.sizes.includes(size)) issues.push(`"${size}" is not a valid size for ${label}.`)
    } else if (size) {
      issues.push(`${label} does not have size options.`)
    }

    // colour
    if (product.colours.length > 0) {
      if (!colourId) issues.push(`Select a colour for ${label}.`)
      else if (!product.colours.some((x) => x.id === colourId)) {
        issues.push(`That colour is not available for ${label}.`)
      }
    } else if (colourId) {
      issues.push(`${label} does not have colour options.`)
    }

    // coverage
    if (product.coverage.length > 0) {
      if (!coverage) issues.push(`Select a coverage for ${label}.`)
      else if (!product.coverage.includes(coverage)) {
        issues.push(`"${coverage}" is not a valid coverage for ${label}.`)
      }
    } else if (coverage) {
      issues.push(`${label} does not have coverage options.`)
    }

    // merge identical product + option combinations
    const key = [productId, size ?? '-', colourId ?? '-', coverage ?? '-'].join('::')
    const existing = merged.get(key)
    if (existing) {
      existing.quantity = Math.min(MAX_QTY, existing.quantity + quantity)
    } else {
      merged.set(key, { product, size, colourId, coverage, quantity })
    }
  }

  if (issues.length > 0) {
    return { ok: false, error: 'Some order details are missing or invalid.', issues }
  }

  // ── authoritative rows + server-calculated subtotal ──
  let subtotalUsdCents = 0
  const itemRows = []

  for (const line of merged.values()) {
    const { product, quantity } = line
    const colour = line.colourId ? product.colours.find((x) => x.id === line.colourId) : null
    const unitUsdCents = toCents(product.price)
    const unitXcdCents = toCents(product.priceXcd)

    subtotalUsdCents += unitUsdCents * quantity

    itemRows.push({
      product_id: product.id,
      product_name: product.title,
      image: product.image,
      unit_price_usd_cents: unitUsdCents,
      unit_price_xcd_cents: unitXcdCents,
      quantity,
      size: line.size,
      colour_id: line.colourId,
      colour_name: colour ? colour.name : null,
      coverage: line.coverage
    })
  }

  const orderRow = {
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    delivery_method: deliveryMethod,
    ...shipping,
    notes,
    subtotal_usd_cents: subtotalUsdCents,
    status: 'pending',
    payment_provider: null,
    payment_id: null
  }

  return { ok: true, orderRow, itemRows, subtotalUsdCents }
}
