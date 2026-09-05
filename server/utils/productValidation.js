/**
 * Server-side validation for admin product writes (POST/PATCH). Mirrors the
 * style of server/utils/fabricValidation.js.
 *
 * The scalar-field validator is a pure function. The relation validators
 * (`validateStringList` for sizes/coverage/details, `validateFabricIds`)
 * are separate; `validateFabricIds` is async because it checks ids against
 * the live `fabrics` table (fabrics have always lived in Supabase).
 */
import { CATEGORIES } from '../../data/constants.js'

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MAX = { name: 120, slug: 120, description: 4000, listItem: 60, list: 40 }

const str = (v) => (typeof v === 'string' ? v.trim() : '')
const isEmpty = (v) => v === null || v === undefined || v === ''

function intOrNull(v) {
  if (isEmpty(v)) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : NaN
}

/**
 * @param {object} body
 * @param {{ partial?: boolean }} opts  partial=false -> create (required fields enforced,
 *        isActive/isFeatured default true/false). partial=true -> patch (only present keys validated).
 * @returns {{ issues: string[], fields: object }}  fields is camelCase, ready to map to columns.
 */
export function validateProductFields(body, { partial = false } = {}) {
  const issues = []
  const b = body && typeof body === 'object' ? body : {}
  const out = {}
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k)
  const provided = (k) => !partial || has(k)

  if (provided('name')) {
    const name = str(b.name)
    if (!name) issues.push('Name is required.')
    else if (name.length > MAX.name) issues.push('Name is too long.')
    out.name = name
  }

  if (provided('slug')) {
    const slug = str(b.slug).toLowerCase()
    if (!slug || !SLUG_RE.test(slug)) issues.push('Slug must be lowercase kebab-case, e.g. "kir-royale-top".')
    else if (slug.length > MAX.slug) issues.push('Slug is too long.')
    out.slug = slug
  }

  if (provided('category')) {
    const category = str(b.category)
    if (!CATEGORIES.includes(category)) issues.push(`Category must be one of: ${CATEGORIES.join(', ')}.`)
    out.category = category
  }

  if (provided('description')) {
    const description = isEmpty(b.description) ? null : str(b.description)
    if (description && description.length > MAX.description) issues.push('Description is too long.')
    out.description = description
  }

  for (const key of ['priceUsdCents', 'priceXcdCents']) {
    if (provided(key)) {
      const n = intOrNull(b[key])
      if (n === null || Number.isNaN(n) || !Number.isInteger(n) || n < 0) {
        issues.push(`${key === 'priceUsdCents' ? 'USD' : 'XCD'} price must be a whole number of cents ≥ 0.`)
      }
      out[key] = n
    }
  }

  if (has('isActive')) {
    if (typeof b.isActive !== 'boolean') issues.push('isActive must be true or false.')
    out.isActive = b.isActive
  } else if (!partial) {
    out.isActive = true
  }

  if (has('isFeatured')) {
    if (typeof b.isFeatured !== 'boolean') issues.push('isFeatured must be true or false.')
    out.isFeatured = b.isFeatured
  } else if (!partial) {
    out.isFeatured = false
  }

  if (provided('sortOrder')) {
    if (isEmpty(b.sortOrder)) {
      out.sortOrder = null
    } else {
      const n = intOrNull(b.sortOrder)
      if (Number.isNaN(n) || !Number.isInteger(n)) issues.push('Sort order must be a whole number or blank.')
      out.sortOrder = n
    }
  }

  return { issues, fields: out }
}

/**
 * Validate one of the string-list relations (sizes / coverage / details).
 * Returns `values: undefined` when the key was omitted entirely (PATCH
 * callers use this to mean "don't touch this relation").
 */
export function validateStringList(raw, label) {
  if (raw === undefined) return { issues: [], values: undefined }
  if (!Array.isArray(raw)) return { issues: [`${label} must be an array.`], values: [] }
  const values = [...new Set(raw.map((v) => str(v)).filter(Boolean))]
  const issues = []
  if (values.length > MAX.list) issues.push(`Too many ${label.toLowerCase()}.`)
  if (values.some((v) => v.length > MAX.listItem)) issues.push(`A ${label.toLowerCase()} entry is too long.`)
  return { issues, values }
}

/**
 * Validate a `fabricIds` array of fabric UUIDs against the live `fabrics`
 * table. Returns `fabricIds: undefined` when omitted (PATCH = "don't touch
 * fabric compatibility"). Async — needs a Supabase client.
 */
export async function validateFabricIds(raw, supabase) {
  if (raw === undefined) return { issues: [], fabricIds: undefined }
  if (!Array.isArray(raw)) return { issues: ['fabricIds must be an array.'], fabricIds: [] }

  const ids = [...new Set(raw.map((v) => str(v)).filter(Boolean))]
  if (ids.some((id) => !UUID_RE.test(id))) {
    return { issues: ['One or more fabric ids are malformed.'], fabricIds: ids }
  }
  if (ids.length === 0) return { issues: [], fabricIds: [] }

  const { data, error } = await supabase.from('fabrics').select('id').in('id', ids)
  if (error) return { issues: ['Could not verify the selected fabrics.'], fabricIds: ids }

  const known = new Set((data ?? []).map((r) => r.id))
  const unknown = ids.filter((id) => !known.has(id))
  const issues = unknown.length ? [`Unknown fabric id(s): ${unknown.join(', ')}.`] : []
  return { issues, fabricIds: ids }
}
