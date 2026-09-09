import { describe, it, expect } from 'vitest'
import * as templates from '../server/utils/emailTemplates.js'
import {
  inquiryAckEmail,
  inquiryAdminEmail,
  orderConfirmationEmail,
  orderAdminEmail,
  usd
} from '../server/utils/emailTemplates.js'

const ALL = (e) => `${e.subject}\n${e.html}\n${e.text}`

describe('email templates — shared rules', () => {
  it('every builder returns a populated plain-text fallback', () => {
    for (const e of [
      inquiryAckEmail({ firstName: 'Reann' }),
      inquiryAdminEmail({ email: 'a@b.co', subject: 'Wholesale', message: 'hi' }),
      orderConfirmationEmail({ orderNumber: 'BM-000007', items: [], totalUsdCents: 0 }),
      orderAdminEmail({ orderNumber: 'BM-000007', items: [], totalUsdCents: 0 })
    ]) {
      expect(e.text.trim().length).toBeGreaterThan(20)
      expect(e.html).toContain('<!doctype html>')
    }
  })

  it('every template here is transactional — no unsubscribe / marketing language', () => {
    for (const e of [
      inquiryAckEmail({ firstName: 'X' }),
      inquiryAdminEmail({ email: 'a@b.co' }),
      orderConfirmationEmail({ orderNumber: 'BM-1', items: [], totalUsdCents: 100 }),
      orderAdminEmail({ orderNumber: 'BM-1', items: [], totalUsdCents: 100 })
    ]) {
      expect(ALL(e).toLowerCase()).not.toContain('unsubscribe')
    }
  })

  it('no newsletter/welcome builder is exported (welcome is a Brevo Automation)', () => {
    expect(templates.welcomeEmail).toBeUndefined()
  })
})

describe('inquiryAckEmail', () => {
  it('greets by first name when available, confirms receipt, promises no specific time', () => {
    const e = inquiryAckEmail({ firstName: 'Reann' })
    expect(e.html).toContain('Hi Reann,')
    expect(ALL(e).toLowerCase()).toContain('in touch')
    expect(ALL(e)).not.toMatch(/\b(24 hours|48 hours|business days?)\b/i)
  })
  it('falls back to a generic greeting without a first name', () => {
    expect(inquiryAckEmail({}).html).toContain('Hi there,')
  })
})

describe('inquiryAdminEmail', () => {
  const inq = {
    id: 'inq-9',
    firstName: 'Reann',
    lastName: 'Edwards',
    email: 'reann@example.com',
    phone: '+14730001111',
    subject: 'Wholesale',
    message: 'Do you offer wholesale pricing?'
  }
  it('includes name, email, phone, subject, message and inquiry id', () => {
    const body = ALL(inquiryAdminEmail(inq))
    expect(body).toContain('Reann Edwards')
    expect(body).toContain('reann@example.com')
    expect(body).toContain('+14730001111')
    expect(body).toContain('Wholesale')
    expect(body).toContain('Do you offer wholesale pricing?')
    expect(body).toContain('inq-9')
  })
  it('omits the phone row when no phone was given', () => {
    const body = ALL(inquiryAdminEmail({ ...inq, phone: undefined }))
    expect(body).not.toMatch(/Phone/)
  })
})

describe('orderConfirmationEmail', () => {
  const order = {
    orderNumber: 'BM-000007',
    firstName: 'Reann',
    items: [
      { name: 'Reef One-Piece', quantity: 2, size: 'M', colour: 'Coral', coverage: 'Full' }
    ],
    totalUsdCents: 24000,
    deliveryMethod: 'shipping',
    shipping: { address1: '1 Palm Rd', city: 'St. George', country: 'Grenada' }
  }
  it('includes order number, item details, USD total, turnaround, reply note and address', () => {
    const body = ALL(orderConfirmationEmail(order))
    expect(body).toContain('BM-000007')
    expect(body).toContain('Reef One-Piece')
    expect(body).toContain('2') // quantity
    expect(body).toContain('Size M')
    expect(body).toContain('Coral')
    expect(body).toContain('Full coverage')
    expect(body).toContain('$240.00')
    expect(body).toContain('10–14 business days')
    expect(body.toLowerCase()).toContain('reply to this email')
    expect(body).toContain('1 Palm Rd')
  })
  it('shows a pickup line instead of an address for pickup orders', () => {
    const body = ALL(
      orderConfirmationEmail({ ...order, deliveryMethod: 'pickup', shipping: null })
    )
    expect(body.toLowerCase()).toContain('pickup')
    expect(body).not.toContain('1 Palm Rd')
  })
})

describe('orderAdminEmail', () => {
  const order = {
    orderNumber: 'BM-000007',
    firstName: 'Reann',
    lastName: 'Edwards',
    email: 'reann@example.com',
    phone: '+1473',
    items: [{ name: 'Reef One-Piece', quantity: 1, size: 'M', colour: 'Coral' }],
    totalUsdCents: 12000,
    deliveryMethod: 'pickup'
  }
  it('includes order number, customer, total, items and an admin link when given', () => {
    const body = ALL(orderAdminEmail(order, 'https://site.test/admin/orders/abc'))
    expect(body).toContain('BM-000007')
    expect(body).toContain('Reann Edwards')
    expect(body).toContain('reann@example.com')
    expect(body).toContain('$120.00')
    expect(body).toContain('Reef One-Piece')
    expect(body).toContain('https://site.test/admin/orders/abc')
  })
  it('omits the admin link when none is available', () => {
    const body = ALL(orderAdminEmail(order, null))
    expect(body).not.toContain('/admin/orders/')
  })
})

describe('usd', () => {
  it('formats integer cents', () => {
    expect(usd(0)).toBe('$0.00')
    expect(usd(24000)).toBe('$240.00')
    expect(usd(123456)).toBe('$1,234.56')
  })
})
