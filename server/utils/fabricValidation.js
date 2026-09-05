/**
 * Server-side validation for admin fabric writes (POST/PATCH).
 *
 * `validateFabricFields` is a pure function. `validateProductIds` is async —
 * it checks product slugs against the live Supabase `products` table (since
 * Phase C, products are Supabase-backed, not data/products.js). The Test
 * Product is still excluded — it has no storefront colour options and should
 * never gain a fabric relationship.
 */
export const FABRIC_TYPES = ['solid', 'print', 'mesh', 'specialty']
export const FABRIC_STATUSES = ['available', 'low', 'unavailable']
export const FABRIC_UNITS = ['yards', 'metres']

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const HEX_RE = /^#[0-9a-fA-F]{6}$/
const MAX_NAME = 80
const MAX_IMAGE_URL = 500

const str = (v) => (typeof v === 'string' ? v.trim() : '')
const isEmpty = (v) => v === null || v === undefined || v === ''

/**
 * Validate a fabric's editable fields.
 *
 * `partial: false` (POST/create) — name, slug and type are required; status
 * and isActive default to 'available'/true when omitted; quantity, unit,
 * hexColor, imageUrl default to null when omitted.
 *
 * `partial: true` (PATCH/update) — only fields actually present in the
 * payload are validated and returned; everything else is left untouched by
 * the caller (absent from `fields`).
 *
 * @returns {{ issues: string[], fields: object }}
 */
export function validateFabricFields(body, { partial = false } = {}) {
  const issues = []
  const b = body && typeof body === 'object' ? body : {}
  const out = {}
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k)
  const provided = (k) => !partial || has(k)

  if (provided('name')) {
    const name = str(b.name)
    if (!name) issues.push('Name is required.')
    else if (name.length > MAX_NAME) issues.push('Name is too long.')
    out.name = name
  }

  if (provided('slug')) {
    const slug = str(b.slug).toLowerCase()
    if (!slug || !SLUG_RE.test(slug)) {
      issues.push('Slug must be lowercase kebab-case, e.g. "royal-blue".')
    }
    out.slug = slug
  }

  if (provided('type')) {
    const type = str(b.type)
    if (!FABRIC_TYPES.includes(type)) issues.push(`Type must be one of: ${FABRIC_TYPES.join(', ')}.`)
    out.type = type
  }

  // status — required on create, but defaults to 'available' if omitted entirely.
  if (has('status')) {
    const status = str(b.status)
    if (!FABRIC_STATUSES.includes(status)) issues.push(`Status must be one of: ${FABRIC_STATUSES.join(', ')}.`)
    out.status = status
  } else if (!partial) {
    out.status = 'available'
  }

  // isActive — required on create, but defaults to true if omitted entirely.
  if (has('isActive')) {
    if (typeof b.isActive !== 'boolean') issues.push('isActive must be true or false.')
    out.isActive = b.isActive
  } else if (!partial) {
    out.isActive = true
  }

  if (provided('unit')) {
    if (isEmpty(b.unit)) {
      out.unit = null
    } else {
      const unit = str(b.unit)
      if (!FABRIC_UNITS.includes(unit)) issues.push(`Unit must be null or one of: ${FABRIC_UNITS.join(', ')}.`)
      out.unit = unit
    }
  }

  if (provided('quantity')) {
    if (isEmpty(b.quantity)) {
      out.quantity = null
    } else {
      const qty = typeof b.quantity === 'number' ? b.quantity : Number(b.quantity)
      if (!Number.isFinite(qty) || qty < 0) issues.push('Quantity must be null or a number ≥ 0.')
      out.quantity = qty
    }
  }

  if (provided('hexColor')) {
    if (isEmpty(b.hexColor)) {
      out.hexColor = null
    } else {
      const hex = str(b.hexColor)
      if (!HEX_RE.test(hex)) issues.push('Hex colour must be null or a 6-digit value like #26408B.')
      out.hexColor = hex
    }
  }

  if (provided('imageUrl')) {
    const imageUrl = isEmpty(b.imageUrl) ? null : str(b.imageUrl)
    if (imageUrl && imageUrl.length > MAX_IMAGE_URL) issues.push('Image URL is too long.')
    out.imageUrl = imageUrl
  }

  return { issues, fields: out }
}

/**
 * Validate a `productIds` array (catalogue slugs) against the live Supabase
 * `products` table. Returns `productIds: undefined` when the key was omitted
 * entirely (PATCH callers use this to mean "don't touch relationships").
 * Async — needs a Supabase client.
 */
export async function validateProductIds(rawIds, supabase) {
  if (rawIds === undefined) return { issues: [], productIds: undefined }
  if (!Array.isArray(rawIds)) return { issues: ['productIds must be an array.'], productIds: [] }

  const ids = [...new Set(rawIds.map((v) => str(v)).filter(Boolean))]
  if (ids.length === 0) return { issues: [], productIds: [] }

  const { data, error } = await supabase.from('products').select('slug').neq('slug', 'test-product')
  if (error) return { issues: ['Could not verify the selected products.'], productIds: ids }

  const known = new Set((data ?? []).map((r) => r.slug))
  const invalid = ids.filter((id) => !known.has(id))
  const issues = invalid.length ? [`Unknown product id(s): ${invalid.join(', ')}.`] : []
  return { issues, productIds: ids }
}
