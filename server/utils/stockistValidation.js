/**
 * Server-side validation for admin Stockist writes. Mirrors the style of
 * server/utils/productValidation.js — pure functions, camelCase `fields`
 * output ready to map to columns, `partial` toggles create vs patch rules.
 */
import { MOVEMENT_TYPES } from './stockistInventory.js'

const MAX = { name: 120, location: 120, person: 120, email: 254, notes: 4000, text: 60, refCode: 60 }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const str = (v) => (typeof v === 'string' ? v.trim() : '')
const isEmpty = (v) => v === null || v === undefined || v === ''

function intOrNull(v) {
  if (isEmpty(v)) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : NaN
}

function validateBps(v, label, { required = false } = {}) {
  if (isEmpty(v)) {
    return { value: null, issue: required ? `${label} is required.` : null }
  }
  const n = intOrNull(v)
  if (n === null || Number.isNaN(n) || !Number.isInteger(n) || n < 0 || n > 10000) {
    return { value: NaN, issue: `${label} must be a percentage between 0 and 100.` }
  }
  return { value: n, issue: null }
}

/**
 * @param {object} body
 * @param {{partial?: boolean}} opts partial=false -> create (name required, isActive defaults true).
 * @returns {{issues: string[], fields: object}}
 */
export function validateStockistFields(body, { partial = false } = {}) {
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
  } else if (!partial) {
    issues.push('Name is required.')
  }

  for (const [key, label, max] of [
    ['location', 'Location', MAX.location],
    ['contactName', 'Contact name', MAX.person],
    ['phone', 'Phone', 40],
    ['notes', 'Notes', MAX.notes]
  ]) {
    if (provided(key)) {
      const v = isEmpty(b[key]) ? null : str(b[key])
      if (v && v.length > max) issues.push(`${label} is too long.`)
      out[key] = v
    }
  }

  if (provided('email')) {
    const email = isEmpty(b.email) ? null : str(b.email).toLowerCase()
    if (email && (!EMAIL_RE.test(email) || email.length > MAX.email)) issues.push('Email looks invalid.')
    out.email = email
  }

  if (provided('defaultCommissionBps')) {
    const { value, issue } = validateBps(b.defaultCommissionBps, 'Default commission')
    if (issue) issues.push(issue)
    out.defaultCommissionBps = Number.isNaN(value) ? null : value
  }

  if (has('isActive')) {
    if (typeof b.isActive !== 'boolean') issues.push('isActive must be true or false.')
    out.isActive = b.isActive
  } else if (!partial) {
    out.isActive = true
  }

  return { issues, fields: out }
}

/**
 * Inventory item create/patch. `source` ('product' | 'manual') is required
 * on create and drives which fields matter — for 'product', productId is
 * required and productNameSnapshot/productImageSnapshot are normally supplied
 * by the endpoint from the live product row, not typed by the admin.
 */
export function validateInventoryItemFields(body, { partial = false } = {}) {
  const issues = []
  const b = body && typeof body === 'object' ? body : {}
  const out = {}
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k)
  const provided = (k) => !partial || has(k)

  if (!partial) {
    const source = str(b.source)
    if (source !== 'product' && source !== 'manual') {
      issues.push('source must be "product" or "manual".')
    }
    out.source = source

    if (source === 'product') {
      const productId = str(b.productId)
      if (!productId) issues.push('productId is required for a website product item.')
      out.productId = productId || null
    } else {
      out.productId = null
    }

    const nameSnapshot = str(b.productNameSnapshot)
    if (!nameSnapshot) issues.push('Product/item name is required.')
    else if (nameSnapshot.length > MAX.name) issues.push('Product/item name is too long.')
    out.productNameSnapshot = nameSnapshot
  }

  if (provided('productImageSnapshot')) {
    out.productImageSnapshot = isEmpty(b.productImageSnapshot) ? null : str(b.productImageSnapshot)
  }

  if (provided('referenceCode')) {
    const v = isEmpty(b.referenceCode) ? null : str(b.referenceCode)
    if (v && v.length > MAX.refCode) issues.push('Reference number is too long.')
    out.referenceCode = v
  }

  for (const key of ['colour', 'size', 'coverage']) {
    if (provided(key)) {
      const v = isEmpty(b[key]) ? null : str(b[key])
      if (v && v.length > MAX.text) issues.push(`${key[0].toUpperCase()}${key.slice(1)} is too long.`)
      out[key] = v
    }
  }

  if (provided('retailPriceCents')) {
    const n = intOrNull(b.retailPriceCents)
    if (n === null || Number.isNaN(n) || !Number.isInteger(n) || n < 0) {
      issues.push('Retail price must be a whole number of cents ≥ 0.')
    }
    out.retailPriceCents = n
  } else if (!partial) {
    issues.push('Retail price is required.')
  }

  if (provided('defaultCommissionBps')) {
    const { value, issue } = validateBps(b.defaultCommissionBps, 'Commission', { required: !partial })
    if (issue) issues.push(issue)
    out.defaultCommissionBps = value
  } else if (!partial) {
    issues.push('Commission is required.')
  }

  if (provided('notes')) {
    const v = isEmpty(b.notes) ? null : str(b.notes)
    if (v && v.length > MAX.notes) issues.push('Notes are too long.')
    out.notes = v
  }

  if (has('isArchived')) {
    if (typeof b.isArchived !== 'boolean') issues.push('isArchived must be true or false.')
    out.isArchived = b.isArchived
  }

  // Only relevant on create — the initial SENT movement.
  if (!partial) {
    const qty = intOrNull(b.initialQuantity)
    if (qty === null || Number.isNaN(qty) || !Number.isInteger(qty) || qty <= 0) {
      issues.push('Initial quantity must be a whole number greater than zero.')
    }
    out.initialQuantity = qty

    const dateSent = str(b.dateSent)
    if (!dateSent || Number.isNaN(Date.parse(dateSent))) {
      issues.push('Date sent is required.')
    }
    out.dateSent = dateSent || null
  }

  return { issues, fields: out }
}

/**
 * A movement request (Restock / Mark Sold / Return / Remove — never 'sent',
 * which only ever comes from item creation).
 */
export function validateMovementInput(body) {
  const issues = []
  const b = body && typeof body === 'object' ? body : {}
  const out = {}

  const type = str(b.type)
  if (!MOVEMENT_TYPES.includes(type) || type === 'sent') {
    issues.push('Movement type must be one of: restock, sold, returned, removed.')
  }
  out.type = type

  const quantity = intOrNull(b.quantity)
  if (quantity === null || Number.isNaN(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
    issues.push('Quantity must be a whole number greater than zero.')
  }
  out.quantity = quantity

  const occurredOn = str(b.occurredOn)
  if (!occurredOn || Number.isNaN(Date.parse(occurredOn))) {
    issues.push('Date is required.')
  }
  out.occurredOn = occurredOn || null

  out.note = isEmpty(b.note) ? null : str(b.note).slice(0, MAX.notes)

  if (type === 'sold') {
    const priceCents = intOrNull(b.saleUnitPriceCents)
    if (priceCents === null || Number.isNaN(priceCents) || !Number.isInteger(priceCents) || priceCents < 0) {
      issues.push('Sale price must be a whole number of cents ≥ 0.')
    }
    out.saleUnitPriceCents = priceCents

    const { value, issue } = validateBps(b.saleCommissionBps, 'Commission', { required: true })
    if (issue) issues.push(issue)
    out.saleCommissionBps = value
  } else {
    out.saleUnitPriceCents = null
    out.saleCommissionBps = null
  }

  return { issues, fields: out }
}
