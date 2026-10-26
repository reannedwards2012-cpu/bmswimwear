import { QUOTE_CATEGORIES } from '../../utils/quoteCalculator.js'

export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired']

const str = (v) => (typeof v === 'string' ? v.trim() : '')
const isEmpty = (v) => v === null || v === undefined || v === ''
const MAX_NAME = 120
const MAX_TEXT = 4000
const MAX_URL = 500
const MAX_IMAGES = 12

function numberOrIssue(value, label, issues, { allowNull = false, min = 0 } = {}) {
  if (allowNull && isEmpty(value)) return null
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num) || num < min) {
    issues.push(`${label} must be a number${min === 0 ? ' ≥ 0' : ` ≥ ${min}`}.`)
    return 0
  }
  return num
}

/**
 * Validate a quote's top-level fields (customer info, description, category,
 * status, notes, inspiration images). Does NOT validate the calculator
 * input — see validateCalculatorInput below, kept separate because it's
 * reused by the pricing-settings "preview" path too.
 *
 * `partial: true` (PATCH) — only fields present in the payload are
 * validated/returned.
 */
export function validateQuoteFields(body, { partial = false } = {}) {
  const issues = []
  const b = body && typeof body === 'object' ? body : {}
  const out = {}
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k)
  const provided = (k) => !partial || has(k)

  if (provided('customerName')) {
    const name = str(b.customerName)
    if (!name) issues.push('Customer name is required.')
    else if (name.length > MAX_NAME) issues.push('Customer name is too long.')
    out.customerName = name
  }

  if (provided('customerEmail')) {
    out.customerEmail = isEmpty(b.customerEmail) ? null : str(b.customerEmail)
  }

  if (provided('customerPhone')) {
    out.customerPhone = isEmpty(b.customerPhone) ? null : str(b.customerPhone)
  }

  if (provided('description')) {
    const description = isEmpty(b.description) ? null : str(b.description)
    if (description && description.length > MAX_TEXT) issues.push('Description is too long.')
    out.description = description
  }

  if (provided('category')) {
    const category = str(b.category)
    if (!QUOTE_CATEGORIES.includes(category)) {
      issues.push(`Category must be one of: ${QUOTE_CATEGORIES.join(', ')}.`)
    }
    out.category = category
  }

  if (has('status')) {
    const status = str(b.status)
    if (!QUOTE_STATUSES.includes(status)) issues.push(`Status must be one of: ${QUOTE_STATUSES.join(', ')}.`)
    out.status = status
  } else if (!partial) {
    out.status = 'draft'
  }

  if (provided('customerNotes')) {
    const notes = isEmpty(b.customerNotes) ? null : str(b.customerNotes)
    if (notes && notes.length > MAX_TEXT) issues.push('Customer notes are too long.')
    out.customerNotes = notes
  }

  if (provided('adminNotes')) {
    const notes = isEmpty(b.adminNotes) ? null : str(b.adminNotes)
    if (notes && notes.length > MAX_TEXT) issues.push('Admin notes are too long.')
    out.adminNotes = notes
  }

  if (provided('inspirationImageUrls') && (has('inspirationImageUrls') || !partial)) {
    const raw = has('inspirationImageUrls') ? b.inspirationImageUrls : []
    if (!Array.isArray(raw)) {
      issues.push('inspirationImageUrls must be an array.')
      out.inspirationImageUrls = []
    } else {
      const urls = raw.map((v) => str(v)).filter(Boolean)
      if (urls.length > MAX_IMAGES) issues.push(`A quote can have at most ${MAX_IMAGES} inspiration images.`)
      if (urls.some((u) => u.length > MAX_URL)) issues.push('One of the inspiration image URLs is too long.')
      out.inspirationImageUrls = urls.slice(0, MAX_IMAGES)
    }
  }

  return { issues, fields: out }
}

/**
 * Validate the raw calculator input a client submits. This is distinct from
 * calculateQuote() itself — it checks shape/types/ranges BEFORE the numbers
 * ever reach the pure calculator, so a malformed payload fails with a clear
 * message instead of silently producing NaN/garbage pricing.
 */
export function validateCalculatorInput(body) {
  const issues = []
  const b = body && typeof body === 'object' ? body : {}

  const category = str(b.category)
  if (!QUOTE_CATEGORIES.includes(category)) {
    issues.push(`Category must be one of: ${QUOTE_CATEGORIES.join(', ')}.`)
  }

  const out = { category }
  out.productionHours = numberOrIssue(b.productionHours, 'Production hours', issues)
  out.labourRateXcdCents = numberOrIssue(b.labourRateXcdCents, 'Labour rate', issues)
  out.fabricCostPerYardXcdCents = numberOrIssue(b.fabricCostPerYardXcdCents, 'Fabric cost per yard', issues)
  out.fabricYards = numberOrIssue(b.fabricYards, 'Fabric yards', issues)
  out.packagingXcdCents = numberOrIssue(b.packagingXcdCents, 'Packaging cost', issues)
  out.consumablesXcdCents = numberOrIssue(b.consumablesXcdCents, 'Consumables cost', issues)
  out.additionalMaterialsXcdCents = numberOrIssue(b.additionalMaterialsXcdCents ?? 0, 'Additional materials cost', issues)
  out.electricityMonthlyXcdCents = numberOrIssue(b.electricityMonthlyXcdCents, 'Monthly electricity cost', issues)
  out.machineMaintenanceMonthlyXcdCents = numberOrIssue(
    b.machineMaintenanceMonthlyXcdCents,
    'Monthly machine maintenance cost',
    issues
  )
  out.expectedMonthlyVolume = numberOrIssue(b.expectedMonthlyVolume, 'Expected monthly volume', issues, { min: 1 })
  out.designFeeXcdCents = numberOrIssue(b.designFeeXcdCents ?? 0, 'Design development fee', issues)
  out.designHours = numberOrIssue(b.designHours ?? 0, 'Design hours', issues)
  out.designHoursBillable = b.designHoursBillable === true
  out.fittingAllowanceXcdCents = numberOrIssue(b.fittingAllowanceXcdCents ?? 0, 'Fitting allowance', issues)
  out.targetMarginPercent = numberOrIssue(b.targetMarginPercent, 'Target margin', issues)
  if (out.targetMarginPercent >= 100) issues.push('Target margin must be less than 100%.')
  out.depositPercent = numberOrIssue(b.depositPercent, 'Deposit percent', issues)
  if (out.depositPercent > 100) issues.push('Deposit percent must be 100% or less.')
  out.categoryMinimumXcdCents = numberOrIssue(b.categoryMinimumXcdCents, 'Category minimum price', issues, { allowNull: true })
  out.finalPriceOverrideXcdCents = numberOrIssue(b.finalPriceOverrideXcdCents, 'Final price override', issues, { allowNull: true })
  out.fabricId = isEmpty(b.fabricId) ? null : str(b.fabricId)

  return { issues, input: out }
}

// camelCase field -> { min, allowNull, label } for quote_pricing_settings.
const SETTINGS_NUMERIC_FIELDS = {
  labourRateXcdCents: { label: 'Labour rate' },
  defaultHoursBasicBikini: { label: 'Default hours (Basic Bikini)' },
  defaultHoursBasicOnepiece: { label: 'Default hours (Basic One-Piece)' },
  defaultHoursComplexCustom: { label: 'Default hours (Complex Custom)' },
  fabricCostSolidXcdCents: { label: 'Default solid fabric cost' },
  fabricCostPrintedXcdCents: { label: 'Default printed fabric cost' },
  fabricConsumptionBikiniYards: { label: 'Default fabric consumption (bikini)' },
  fabricConsumptionOnepieceYards: { label: 'Default fabric consumption (one-piece)' },
  packagingXcdCents: { label: 'Packaging cost' },
  consumablesXcdCents: { label: 'Consumables cost' },
  electricityMonthlyXcdCents: { label: 'Monthly electricity cost' },
  machineMaintenanceMonthlyXcdCents: { label: 'Monthly machine maintenance cost' },
  expectedMonthlyVolume: { label: 'Expected monthly production volume', min: 1 },
  designFeeMinorXcdCents: { label: 'Design fee (Minor)' },
  designFeeNewXcdCents: { label: 'Design fee (New custom design)' },
  designFeeComplexXcdCents: { label: 'Design fee (Complex)' },
  fittingAllowanceXcdCents: { label: 'Fitting allowance' },
  targetMarginPercent: { label: 'Target margin' },
  depositPercent: { label: 'Deposit percent' },
  minPriceBasicBikiniXcdCents: { label: 'Minimum price (Basic Bikini)', allowNull: true },
  minPriceBasicOnepieceXcdCents: { label: 'Minimum price (Basic One-Piece)', allowNull: true },
  minPriceComplexCustomXcdCents: { label: 'Minimum price (Complex Custom)', allowNull: true },
  minPriceOtherCustomXcdCents: { label: 'Minimum price (Other/Custom)', allowNull: true }
}

/**
 * Validate quote_pricing_settings fields. `partial: true` (PATCH) — only
 * fields present in the payload are validated/returned, mirroring
 * validateFabricFields' convention.
 */
export function validateSettingsFields(body, { partial = true } = {}) {
  const issues = []
  const b = body && typeof body === 'object' ? body : {}
  const out = {}
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k)
  const provided = (k) => !partial || has(k)

  for (const [field, { label, min = 0, allowNull = false }] of Object.entries(SETTINGS_NUMERIC_FIELDS)) {
    if (!provided(field)) continue
    out[field] = numberOrIssue(b[field], label, issues, { allowNull, min })
  }

  if (provided('targetMarginPercent') && out.targetMarginPercent >= 100) {
    issues.push('Target margin must be less than 100%.')
  }
  if (provided('depositPercent') && out.depositPercent > 100) {
    issues.push('Deposit percent must be 100% or less.')
  }

  return { issues, fields: out }
}
