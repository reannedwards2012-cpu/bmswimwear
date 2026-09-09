import { describe, it, expect, vi, afterEach } from 'vitest'
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

describe('email header brand mark', () => {
  const WORDMARK = 'Bahama&nbsp;Mama'
  afterEach(() => vi.unstubAllEnvs())

  it('customer emails show the hosted logo <img> built from the site URL', () => {
    vi.stubEnv('SITE_URL', 'https://bmswimwear.com')
    vi.stubEnv('URL', '')

    for (const e of [
      inquiryAckEmail({ firstName: 'Reann' }),
      orderConfirmationEmail({ orderNumber: 'BM-000007', items: [], totalUsdCents: 0 })
    ]) {
      expect(e.html).toContain(
        '<img src="https://bmswimwear.com/images/bmlogo.png" alt="Bahama Mama Swimwear" width="180" height="70"'
      )
      expect(e.html).toContain('display:block;margin:0 auto;width:180px;height:auto;max-width:100%')
      expect(e.html).not.toContain(WORDMARK) // text wordmark replaced
    }
  })

  it('strips a trailing slash on the site URL when building the logo src', () => {
    vi.stubEnv('SITE_URL', 'https://bmswimwear.com/')
    vi.stubEnv('URL', '')
    expect(inquiryAckEmail({ firstName: 'R' }).html).toContain(
      'src="https://bmswimwear.com/images/bmlogo.png"'
    )
  })

  it('falls back to the text wordmark (no broken <img>) when no site URL is configured', () => {
    vi.stubEnv('SITE_URL', '')
    vi.stubEnv('URL', '')
    for (const e of [
      inquiryAckEmail({ firstName: 'Reann' }),
      orderConfirmationEmail({ orderNumber: 'BM-1', items: [], totalUsdCents: 0 })
    ]) {
      expect(e.html).toContain(WORDMARK)
      expect(e.html).not.toContain('<img')
    }
  })

  it('admin emails keep the text wordmark even when the site URL is set', () => {
    vi.stubEnv('SITE_URL', 'https://bmswimwear.com')
    vi.stubEnv('URL', '')
    for (const e of [
      inquiryAdminEmail({ email: 'a@b.co' }),
      orderAdminEmail({ orderNumber: 'BM-1', items: [], totalUsdCents: 0 })
    ]) {
      expect(e.html).toContain(WORDMARK)
      expect(e.html).not.toContain('<img')
    }
  })
})

describe('inquiryAckEmail', () => {
  it('greets by first name, confirms receipt, promises no specific time, signs off as Reann', () => {
    const e = inquiryAckEmail({ firstName: 'Reann' })
    expect(e.html).toContain('Hi Reann,')
    const body = ALL(e).toLowerCase()
    expect(body).toContain('your message is in')
    expect(body).toContain('get back to you soon')
    expect(body).toContain('just reply to this email')
    expect(ALL(e)).toContain('Talk soon,')
    expect(ALL(e)).toContain('Reann')
    expect(ALL(e)).toContain('Bahama Mama Swimwear')
    expect(ALL(e)).not.toMatch(/\b(24 hours|48 hours|business days?)\b/i)
  })
  it('falls back to a generic greeting without a first name', () => {
    expect(inquiryAckEmail({}).html).toContain('Hi there,')
  })
  it('HTML and plain-text carry the same copy', () => {
    const e = inquiryAckEmail({ firstName: 'Reann' })
    for (const line of [
      'Thanks for reaching out! Your message is in and we’ll get back to you soon.',
      'If there’s anything else you’d like to add in the meantime, just reply to this email.'
    ]) {
      expect(e.html).toContain(line)
      expect(e.text).toContain(line)
    }
    expect(e.text).toContain('Talk soon,\nReann\nBahama Mama Swimwear')
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
  const intl = {
    orderNumber: 'BM-000007',
    firstName: 'Reann',
    items: [{ name: 'Reef One-Piece', quantity: 2, size: 'M', colour: 'Coral', coverage: 'Full' }],
    subtotalUsdCents: 24000,
    shippingUsdCents: 1889,
    totalUsdCents: 25889,
    deliveryLabel: 'International Shipping',
    zoneLabel: 'USA',
    shipping: { address1: '1 Palm Rd', city: 'Miami', region: 'FL', country: 'United States' }
  }
  const local = {
    orderNumber: 'BM-000008',
    firstName: 'Ama',
    items: [{ name: 'Palm Top', quantity: 1 }],
    subtotalUsdCents: 6000,
    shippingUsdCents: 0,
    totalUsdCents: 6000,
    deliveryLabel: 'Local Delivery',
    zoneLabel: null,
    shipping: { address1: '2 Lagoon Rd', city: 'St George', region: 'Saint George', country: 'Grenada' }
  }

  it('shows Subtotal / Shipping / Total, the delivery label, address, turnaround and reply note', () => {
    const body = ALL(orderConfirmationEmail(intl))
    expect(body).toContain('BM-000007')
    expect(body).toContain('Reef One-Piece')
    expect(body).toContain('Size M')
    expect(body).toContain('Full coverage')
    expect(body).toContain('Subtotal')
    expect(body).toContain('$240.00')
    expect(body).toContain('Shipping')
    expect(body).toContain('$18.89')
    expect(body).toContain('Total')
    expect(body).toContain('$258.89')
    expect(body).toContain('International Shipping')
    expect(body).toContain('1 Palm Rd')
    expect(body).toContain('10–14 business days')
    expect(body.toLowerCase()).toContain('reply to this email')
  })

  it('Local Delivery shows shipping as $0.00 and NEVER the word "Free"', () => {
    const body = ALL(orderConfirmationEmail(local))
    expect(body).toContain('Local Delivery')
    expect(body).toContain('Shipping')
    expect(body).toContain('$0.00')
    expect(body.toLowerCase()).not.toContain('free')
    expect(body).toContain('Total')
    expect(body).toContain('$60.00')
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
    subtotalUsdCents: 12000,
    shippingUsdCents: 1630,
    totalUsdCents: 13630,
    deliveryLabel: 'International Shipping',
    zoneLabel: 'Canada',
    shipping: { address1: '9 Maple St', city: 'Toronto', region: 'ON', country: 'Canada' }
  }
  it('includes order number, customer, subtotal/shipping/total, delivery + address, items and admin link', () => {
    const body = ALL(orderAdminEmail(order, 'https://site.test/admin/orders/abc'))
    expect(body).toContain('BM-000007')
    expect(body).toContain('Reann Edwards')
    expect(body).toContain('reann@example.com')
    expect(body).toContain('$120.00') // subtotal
    expect(body).toContain('$16.30') // shipping
    expect(body).toContain('$136.30') // total
    expect(body).toContain('International Shipping')
    expect(body).toContain('Canada')
    expect(body).toContain('9 Maple St')
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
