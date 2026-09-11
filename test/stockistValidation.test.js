import { describe, it, expect } from 'vitest'
import {
  validateStockistFields,
  validateInventoryItemFields,
  validateMovementInput
} from '../server/utils/stockistValidation.js'

// ── create stockist validation ──
describe('validateStockistFields (create)', () => {
  it('valid minimal stockist', () => {
    const { issues, fields } = validateStockistFields({ name: 'The Closet' }, { partial: false })
    expect(issues).toEqual([])
    expect(fields.name).toBe('The Closet')
    expect(fields.isActive).toBe(true)
  })

  it('name is required', () => {
    const { issues } = validateStockistFields({}, { partial: false })
    expect(issues).toContain('Name is required.')
  })

  it('rejects an invalid email', () => {
    const { issues } = validateStockistFields({ name: 'Canella Shop', email: 'not-an-email' }, { partial: false })
    expect(issues.some((m) => /email/i.test(m))).toBe(true)
  })

  it('accepts a valid default commission and converts to the same bps value', () => {
    const { issues, fields } = validateStockistFields({ name: 'Canella Shop', defaultCommissionBps: 1500 }, { partial: false })
    expect(issues).toEqual([])
    expect(fields.defaultCommissionBps).toBe(1500)
  })

  it('rejects a commission outside 0–10000 bps', () => {
    const { issues } = validateStockistFields({ name: 'X', defaultCommissionBps: 10001 }, { partial: false })
    expect(issues.length).toBeGreaterThan(0)
  })

  it('partial (patch) only validates provided keys', () => {
    const { issues, fields } = validateStockistFields({ notes: 'call ahead' }, { partial: true })
    expect(issues).toEqual([])
    expect(fields).toEqual({ notes: 'call ahead' })
  })
})

// ── inventory item validation: website product ──
describe('validateInventoryItemFields — website product item', () => {
  const base = {
    source: 'product',
    productId: '11111111-1111-1111-1111-111111111111',
    productNameSnapshot: 'Mimosa One Piece',
    colour: 'Black',
    size: 'M',
    coverage: 'Cheeky',
    retailPriceCents: 18000,
    defaultCommissionBps: 1500,
    initialQuantity: 3,
    dateSent: '2026-09-01'
  }

  it('valid product item', () => {
    const { issues, fields } = validateInventoryItemFields(base, { partial: false })
    expect(issues).toEqual([])
    expect(fields.source).toBe('product')
    expect(fields.productId).toBe(base.productId)
    expect(fields.colour).toBe('Black')
    expect(fields.size).toBe('M')
    expect(fields.coverage).toBe('Cheeky')
    expect(fields.initialQuantity).toBe(3)
  })

  it('productId is required when source is "product"', () => {
    const { issues } = validateInventoryItemFields({ ...base, productId: '' }, { partial: false })
    expect(issues.some((m) => /productId/.test(m))).toBe(true)
  })

  it('a different SIZE keeps two otherwise-identical variants distinct (not merged/aggregated)', () => {
    const m = validateInventoryItemFields({ ...base, size: 'M' }, { partial: false }).fields
    const l = validateInventoryItemFields({ ...base, size: 'L' }, { partial: false }).fields
    expect(m.size).not.toBe(l.size)
    expect(m).not.toEqual(l)
  })

  it('a different COVERAGE keeps two otherwise-identical variants distinct', () => {
    const cheeky = validateInventoryItemFields({ ...base, coverage: 'Cheeky' }, { partial: false }).fields
    const bikini = validateInventoryItemFields({ ...base, coverage: 'Bikini' }, { partial: false }).fields
    expect(cheeky.coverage).not.toBe(bikini.coverage)
  })
})

// ── inventory item validation: manual item ──
describe('validateInventoryItemFields — manual item', () => {
  const base = {
    source: 'manual',
    productNameSnapshot: 'Sunset Sarong (one-off)',
    referenceCode: 'REF-42',
    colour: 'Coral',
    size: 'One Size',
    retailPriceCents: 9500,
    defaultCommissionBps: 1000,
    initialQuantity: 1,
    dateSent: '2026-09-01'
  }

  it('valid manual item, productId forced to null', () => {
    const { issues, fields } = validateInventoryItemFields(base, { partial: false })
    expect(issues).toEqual([])
    expect(fields.source).toBe('manual')
    expect(fields.productId).toBeNull()
  })

  it('name is required for a manual item', () => {
    const { issues } = validateInventoryItemFields({ ...base, productNameSnapshot: '' }, { partial: false })
    expect(issues.some((m) => /name is required/i.test(m))).toBe(true)
  })

  it('source must be "product" or "manual"', () => {
    const { issues } = validateInventoryItemFields({ ...base, source: 'other' }, { partial: false })
    expect(issues.some((m) => /source/.test(m))).toBe(true)
  })
})

// ── shared create-time rules ──
describe('validateInventoryItemFields — shared create rules', () => {
  const base = {
    source: 'manual',
    productNameSnapshot: 'Item',
    retailPriceCents: 1000,
    defaultCommissionBps: 1000,
    initialQuantity: 2,
    dateSent: '2026-09-01'
  }

  it('retail price is required and must be a non-negative integer', () => {
    expect(validateInventoryItemFields({ ...base, retailPriceCents: undefined }, { partial: false }).issues.length).toBeGreaterThan(0)
    expect(validateInventoryItemFields({ ...base, retailPriceCents: -5 }, { partial: false }).issues.length).toBeGreaterThan(0)
    expect(validateInventoryItemFields({ ...base, retailPriceCents: 1.5 }, { partial: false }).issues.length).toBeGreaterThan(0)
  })

  it('commission is required and must be 0–10000 bps', () => {
    expect(validateInventoryItemFields({ ...base, defaultCommissionBps: undefined }, { partial: false }).issues.length).toBeGreaterThan(0)
    expect(validateInventoryItemFields({ ...base, defaultCommissionBps: 10001 }, { partial: false }).issues.length).toBeGreaterThan(0)
  })

  it('initial quantity must be a positive integer', () => {
    expect(validateInventoryItemFields({ ...base, initialQuantity: 0 }, { partial: false }).issues.length).toBeGreaterThan(0)
    expect(validateInventoryItemFields({ ...base, initialQuantity: -1 }, { partial: false }).issues.length).toBeGreaterThan(0)
  })

  it('date sent is required and must parse', () => {
    expect(validateInventoryItemFields({ ...base, dateSent: '' }, { partial: false }).issues.length).toBeGreaterThan(0)
    expect(validateInventoryItemFields({ ...base, dateSent: 'not-a-date' }, { partial: false }).issues.length).toBeGreaterThan(0)
  })

  it('patch mode only validates provided keys and never requires initialQuantity/dateSent', () => {
    const { issues, fields } = validateInventoryItemFields({ retailPriceCents: 2000 }, { partial: true })
    expect(issues).toEqual([])
    expect(fields).toEqual({ retailPriceCents: 2000 })
  })
})

// ── movement input validation ──
describe('validateMovementInput', () => {
  it('valid restock', () => {
    const { issues, fields } = validateMovementInput({ type: 'restock', quantity: 5, occurredOn: '2026-09-01' })
    expect(issues).toEqual([])
    expect(fields).toMatchObject({ type: 'restock', quantity: 5, occurredOn: '2026-09-01' })
  })

  it('"sent" is rejected — only item creation may record a SENT movement', () => {
    const { issues } = validateMovementInput({ type: 'sent', quantity: 1, occurredOn: '2026-09-01' })
    expect(issues.length).toBeGreaterThan(0)
  })

  it('rejects an unknown type', () => {
    const { issues } = validateMovementInput({ type: 'lost', quantity: 1, occurredOn: '2026-09-01' })
    expect(issues.length).toBeGreaterThan(0)
  })

  it('quantity must be a positive whole number', () => {
    expect(validateMovementInput({ type: 'restock', quantity: 0, occurredOn: '2026-09-01' }).issues.length).toBeGreaterThan(0)
    expect(validateMovementInput({ type: 'restock', quantity: -2, occurredOn: '2026-09-01' }).issues.length).toBeGreaterThan(0)
    expect(validateMovementInput({ type: 'restock', quantity: 1.5, occurredOn: '2026-09-01' }).issues.length).toBeGreaterThan(0)
  })

  it('date is required', () => {
    expect(validateMovementInput({ type: 'restock', quantity: 1, occurredOn: '' }).issues.length).toBeGreaterThan(0)
  })

  it('SOLD requires a sale price and commission', () => {
    const { issues } = validateMovementInput({ type: 'sold', quantity: 1, occurredOn: '2026-09-01' })
    expect(issues.some((m) => /price/i.test(m))).toBe(true)
    expect(issues.some((m) => /commission/i.test(m))).toBe(true)
  })

  it('SOLD: EC$180 at 15% — matches the brief\'s own worked example', () => {
    const { issues, fields } = validateMovementInput({
      type: 'sold',
      quantity: 1,
      occurredOn: '2026-09-01',
      saleUnitPriceCents: 18000,
      saleCommissionBps: 1500
    })
    expect(issues).toEqual([])
    expect(fields.saleUnitPriceCents).toBe(18000)
    expect(fields.saleCommissionBps).toBe(1500)
  })

  it('non-SOLD movements ignore any sale price/commission passed', () => {
    const { fields } = validateMovementInput({
      type: 'restock',
      quantity: 1,
      occurredOn: '2026-09-01',
      saleUnitPriceCents: 18000,
      saleCommissionBps: 1500
    })
    expect(fields.saleUnitPriceCents).toBeNull()
    expect(fields.saleCommissionBps).toBeNull()
  })
})
