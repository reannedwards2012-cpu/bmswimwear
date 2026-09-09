/**
 * Authoritative shipping engine for Bahama Mama Swimwear checkout.
 *
 * Pure module — no Nitro / Supabase / Brevo imports — so it unit-tests directly
 * and is reused by BOTH the display-only quote endpoint
 * (server/api/checkout/quote.post.js) and the authoritative order builder
 * (server/utils/checkoutOrder.js). NOTHING here trusts a browser-supplied
 * weight, rate, zone, or amount.
 *
 * ── Delivery model ────────────────────────────────────────────────────────
 *   Grenada   → LOCAL DELIVERY, Saint George parish only, no charge
 *               (zone 'local'). Grenada is NEVER an international destination
 *               and is deliberately absent from COUNTRY_ZONE.
 *   Elsewhere → INTERNATIONAL SHIPPING, priced from a Grenada Post zone +
 *               billable weight. A country with no mapped zone is REJECTED —
 *               no order, no Go2Pay request, no geographic guessing.
 *
 * ── Money ─────────────────────────────────────────────────────────────────
 *   Grenada Post rates are XCD. All math is integer cents. The site's fixed
 *   relationship is US$1 = EC$2.70, i.e. usdCents = round(xcdCents * 10 / 27).
 */

// ── Product weight — category-based, authoritative ────────────────────────
// Quarter-pound integer units keep the running total exact (every weight is a
// multiple of 0.25 lb, and /4 by a power of two is lossless).
const CATEGORY_QUARTER_LB = {
  'One Pieces': 2, // 0.50 lb
  'Cover Ups': 2, // 0.50 lb
  Tops: 1, // 0.25 lb
  Bottoms: 1 // 0.25 lb
}

export const SUPPORTED_CATEGORIES = Object.keys(CATEGORY_QUARTER_LB)

/** Thrown when a line item's category has no authoritative shipping weight. */
export class UnknownCategoryError extends Error {
  constructor(category) {
    super(`No shipping weight for product category ${JSON.stringify(category)} — catalogue/config problem`)
    this.name = 'UnknownCategoryError'
    this.category = category
  }
}

/**
 * Grenada Post billable weight: nearest whole pound, 1 lb minimum.
 *   0.25→1  1.0→1  1.4→1  1.5→2  2.4→2  2.5→3 …
 */
export function roundBillableLb(totalLb) {
  return Math.max(1, Math.round(Number(totalLb) || 0))
}

/**
 * Billable weight (whole lb) for a set of catalogue line items.
 * @param {Array<{category:string, quantity:number}>} items
 * @throws {UnknownCategoryError}  unknown category — never guessed
 * @throws {Error}                 invalid quantity
 */
export function billableWeightLb(items) {
  let quarterUnits = 0
  for (const it of Array.isArray(items) ? items : []) {
    const units = CATEGORY_QUARTER_LB[it && it.category]
    if (units === undefined) throw new UnknownCategoryError(it && it.category)
    const qty = Number(it && it.quantity)
    if (!Number.isInteger(qty) || qty < 1) {
      throw new Error(`Invalid quantity for shipping weight: ${JSON.stringify(it && it.quantity)}`)
    }
    quarterUnits += units * qty
  }
  return roundBillableLb(quarterUnits / 4)
}

// ── Grenada Post international zone rates (integer XCD cents) ──────────────
export const ZONE_RATES = {
  caribbean: { firstLb: 3000, addlLb: 500, label: 'Caribbean' },
  usa: { firstLb: 3400, addlLb: 700, label: 'USA' },
  canada: { firstLb: 3600, addlLb: 700, label: 'Canada' },
  uk: { firstLb: 4100, addlLb: 900, label: 'UK' },
  south_america: { firstLb: 4600, addlLb: 1000, label: 'South America' },
  central_america: { firstLb: 10000, addlLb: 1900, label: 'Central America' },
  europe: { firstLb: 10500, addlLb: 2000, label: 'Europe' },
  africa: { firstLb: 10500, addlLb: 2000, label: 'Africa' },
  asia: { firstLb: 10500, addlLb: 2000, label: 'Asia' },
  middle_east: { firstLb: 10500, addlLb: 2000, label: 'Middle East' }
}

// Flat handling allowance, folded into "Shipping" — NEVER shown as its own
// line to the customer. Added exactly once per international order.
export const HANDLING_XCD_CENTS = 1000 // EC$10

/** US$1 = EC$2.70  ⇒  usdCents = xcdCents * 10 / 27 (integer, bankers-safe). */
export function xcdCentsToUsdCents(xcdCents) {
  return Math.round((Number(xcdCents) || 0) * 10 / 27)
}

/**
 * International shipping charge in USD cents for a zone + billable weight.
 *   postageXcd  = firstLb + (billableLb - 1) * addlLb
 *   shippingXcd = postageXcd + handling
 *   → converted to USD cents
 */
export function internationalShippingUsdCents(zoneKey, billableLb) {
  const rate = ZONE_RATES[zoneKey]
  if (!rate) throw new Error(`No Grenada Post rate for zone ${JSON.stringify(zoneKey)}`)
  const lb = roundBillableLb(billableLb)
  const postageXcdCents = rate.firstLb + (lb - 1) * rate.addlLb
  return xcdCentsToUsdCents(postageXcdCents + HANDLING_XCD_CENTS)
}

// ── Country → Grenada Post zone ──────────────────────────────────────────
// Only destinations whose Grenada Post postal classification is unambiguous.
// Grenada is intentionally absent (local delivery only). Australia, Bermuda,
// Guyana, Mexico, New Zealand, Puerto Rico and the US Virgin Islands are
// intentionally absent pending confirmation of their Grenada Post rate — they
// get the same safe "unsupported destination" treatment as "Other" until then.
export const COUNTRY_ZONE = {
  // Caribbean
  'Antigua and Barbuda': 'caribbean',
  Aruba: 'caribbean',
  Bahamas: 'caribbean',
  Barbados: 'caribbean',
  'British Virgin Islands': 'caribbean',
  'Cayman Islands': 'caribbean',
  Cuba: 'caribbean',
  'Curaçao': 'caribbean',
  Dominica: 'caribbean',
  'Dominican Republic': 'caribbean',
  Guadeloupe: 'caribbean',
  Haiti: 'caribbean',
  Jamaica: 'caribbean',
  Martinique: 'caribbean',
  Montserrat: 'caribbean',
  'Saint Kitts and Nevis': 'caribbean',
  'Saint Lucia': 'caribbean',
  'Saint Vincent and the Grenadines': 'caribbean',
  'Trinidad and Tobago': 'caribbean',
  'Turks and Caicos Islands': 'caribbean',
  // USA / Canada / UK
  'United States': 'usa',
  Canada: 'canada',
  'United Kingdom': 'uk',
  // South America
  Argentina: 'south_america',
  Brazil: 'south_america',
  Chile: 'south_america',
  Colombia: 'south_america',
  Ecuador: 'south_america',
  Peru: 'south_america',
  Uruguay: 'south_america',
  Venezuela: 'south_america',
  // Central America
  Belize: 'central_america',
  'Costa Rica': 'central_america',
  Guatemala: 'central_america',
  Panama: 'central_america',
  // Europe
  Austria: 'europe',
  Belgium: 'europe',
  Denmark: 'europe',
  Finland: 'europe',
  France: 'europe',
  Germany: 'europe',
  Greece: 'europe',
  Iceland: 'europe',
  Ireland: 'europe',
  Italy: 'europe',
  Netherlands: 'europe',
  Norway: 'europe',
  Portugal: 'europe',
  Spain: 'europe',
  Sweden: 'europe',
  Switzerland: 'europe',
  // Africa
  Ghana: 'africa',
  Kenya: 'africa',
  Nigeria: 'africa',
  'South Africa': 'africa',
  // Asia
  China: 'asia',
  India: 'asia',
  Japan: 'asia',
  Singapore: 'asia',
  // Middle East
  Israel: 'middle_east',
  'United Arab Emirates': 'middle_east'
}

export const GRENADA = 'Grenada'

/**
 * International zone for a destination country, or null when the country is
 * Grenada (local), "Other", or simply not mapped yet. null ⇒ no automated
 * international checkout.
 */
export function zoneForCountry(country) {
  return COUNTRY_ZONE[String(country || '').trim()] ?? null
}

// ── Grenada parish — Saint George recognition ────────────────────────────
function normalizeParish(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[.'’`]/g, '')
    .replace(/\bsaint\b/g, 'st')
    .replace(/\bparish\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** True for "St. George", "Saint George", "St George's", "St. George Parish", … */
export function isStGeorge(region) {
  const n = normalizeParish(region)
  return n === 'st george' || n === 'st georges'
}

// ── Customer-facing messages ────────────────────────────────────────────
export const UNSUPPORTED_DESTINATION_MESSAGE =
  'We can’t calculate shipping to this destination automatically. Please contact hello@bmswimwear.com and we’ll arrange it.'
export const GRENADA_PARISH_MESSAGE =
  'Local delivery is currently available within St. George only.'
export const WEIGHT_CONFIG_MESSAGE =
  'We couldn’t work out shipping for one of these items. Please contact hello@bmswimwear.com and we’ll help.'

// ── Display labels (safe to surface anywhere) ───────────────────────────
/** "Local Delivery" / "International Shipping" — never "Shipping" or "Pickup" for a real zone. */
export function deliveryLabel(zone, deliveryMethod) {
  if (zone === 'local') return 'Local Delivery'
  if (zone && ZONE_RATES[zone]) return 'International Shipping'
  // historical / manual rows with no zone
  if (deliveryMethod === 'pickup') return 'Pickup'
  if (deliveryMethod === 'shipping') return 'Shipping'
  return 'Delivery'
}

/** Human zone name for international orders, else null. */
export function zoneLabel(zone) {
  return (ZONE_RATES[zone] && ZONE_RATES[zone].label) || null
}

/**
 * The single authoritative delivery resolution.
 *
 * @param {{ country:string, region:string, items:Array<{category,quantity}> }} input
 * @returns {{ ok:true, method:'local_delivery'|'international_shipping',
 *             zone:string, billableWeightLb:number|null, shippingUsdCents:number }
 *        | { ok:false, code:'no_country'|'empty'|'grenada_parish'
 *               |'unsupported_destination'|'weight_config', error:string, detail?:string }}
 */
export function resolveDelivery({ country, region, items } = {}) {
  const c = String(country || '').trim()
  if (!c) return { ok: false, code: 'no_country', error: 'Select a delivery country.' }

  const list = Array.isArray(items) ? items : []
  if (list.length === 0) return { ok: false, code: 'empty', error: 'Your cart is empty.' }

  // ── Grenada: local delivery, Saint George only, no charge ──
  if (c === GRENADA) {
    if (!isStGeorge(region)) {
      return { ok: false, code: 'grenada_parish', error: GRENADA_PARISH_MESSAGE }
    }
    return { ok: true, method: 'local_delivery', zone: 'local', billableWeightLb: null, shippingUsdCents: 0 }
  }

  // ── International ──
  const zone = zoneForCountry(c)
  if (!zone) {
    return { ok: false, code: 'unsupported_destination', error: UNSUPPORTED_DESTINATION_MESSAGE }
  }

  let billable
  try {
    billable = billableWeightLb(list)
  } catch (err) {
    if (err instanceof UnknownCategoryError) {
      return { ok: false, code: 'weight_config', error: WEIGHT_CONFIG_MESSAGE, detail: err.message }
    }
    throw err
  }

  return {
    ok: true,
    method: 'international_shipping',
    zone,
    billableWeightLb: billable,
    shippingUsdCents: internationalShippingUsdCents(zone, billable)
  }
}
