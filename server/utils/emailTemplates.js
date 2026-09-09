/**
 * Reusable branded HTML + plain-text builders for the Bahama Mama TRANSACTIONAL
 * emails: inquiry acknowledgment, inquiry admin notification, paid-order
 * confirmation, paid-order admin notification.
 *
 * Pure module — no Nitro / Supabase / Brevo imports — so it unit-tests directly.
 *
 * Design: one shared responsive shell. Warm sand background, cream card,
 * cocoa-brown text, coral accent — the site's own direction, kept deliberately
 * simple. Table layout + inline styles for mail-client compatibility. No image
 * assets, no web fonts. Every builder returns { subject, html, text } with the
 * plain-text part always populated.
 *
 * These are all transactional and carry NO unsubscribe / marketing language.
 * The newsletter welcome email is NOT here — it is a Brevo Automation on
 * List #3, so Brevo owns its content and its (marketing) unsubscribe.
 */

const C = {
  bg: '#FAF2EA', // sand — page
  card: '#FFFDFA', // cream — card
  ink: '#5A4035', // cocoa — text
  muted: '#8C7B70', // muted brown
  accent: '#E66B45', // coral
  hair: '#ECDDCB' // hairline
}

const SITE_NAME = 'Bahama Mama Swimwear'
const ADMIN_EMAIL = 'hello@bmswimwear.com'
const TURNAROUND = '10–14 business days'

const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const SERIF = "Georgia,'Times New Roman',serif"

export function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Format integer USD cents as "$1,234.50". */
export function usd(cents) {
  const n = Number(cents || 0) / 100
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const para = (html) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${C.ink};">${html}</p>`

/**
 * Wrap body HTML in the shared branded shell.
 * @param {{ heading?: string, bodyHtml: string, preheader?: string }} opts
 */
function shell({ heading, bodyHtml, preheader }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(heading || SITE_NAME)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
        <tr>
          <td style="padding:0 4px 18px;text-align:center;">
            <span style="font-family:${SERIF};font-size:20px;font-weight:bold;letter-spacing:0.5px;color:${C.ink};">Bahama&nbsp;Mama</span>
            <span style="font-family:${SERIF};font-size:20px;font-weight:bold;color:${C.accent};">&nbsp;Swimwear</span>
          </td>
        </tr>
        <tr>
          <td style="background:${C.card};border:1px solid ${C.hair};border-radius:16px;padding:30px 28px;font-family:${SANS};color:${C.ink};">
            ${heading ? `<h1 style="margin:0 0 16px;font-family:${SERIF};font-size:22px;line-height:1.3;color:${C.ink};">${esc(heading)}</h1>` : ''}
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 8px 0;text-align:center;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};">
            ${SITE_NAME} · St. George, Grenada<br>
            <a href="mailto:${ADMIN_EMAIL}" style="color:${C.muted};">${ADMIN_EMAIL}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

// ── Inquiry: customer acknowledgment ───────────────────────────────────────
export function inquiryAckEmail({ firstName } = {}) {
  const name = (firstName || '').trim()
  const hi = name ? `Hi ${esc(name)},` : 'Hi there,'
  const heading = 'We received your message'
  const bodyHtml = [
    para(hi),
    para(
      `Thanks for reaching out to ${SITE_NAME}. Your message has landed safely in our inbox and a real person will be in touch soon.`
    ),
    para(`If you need to add anything, just reply to this email.`),
    para(`Warmly,<br><span style="color:${C.accent};">The Bahama Mama team</span>`)
  ].join('')

  const text = [
    hi,
    '',
    `Thanks for reaching out to ${SITE_NAME}. Your message has landed safely in our inbox and a real person will be in touch soon.`,
    '',
    'If you need to add anything, just reply to this email.',
    '',
    'Warmly,',
    'The Bahama Mama team'
  ].join('\n')

  return {
    subject: `We received your message — ${SITE_NAME}`,
    html: shell({ heading, bodyHtml, preheader: 'A real person will be in touch soon.' }),
    text
  }
}

// ── Inquiry: admin notification ────────────────────────────────────────────
export function inquiryAdminEmail(inq = {}) {
  const name = [inq.firstName, inq.lastName].filter(Boolean).join(' ').trim() || '—'
  const rows = [
    ['Name', name],
    ['Email', inq.email || '—'],
    ...(inq.phone ? [['Phone', inq.phone]] : []),
    ['Subject', inq.subject || '—'],
    ...(inq.id ? [['Inquiry ID', String(inq.id)]] : [])
  ]

  const rowsHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;font-size:13px;color:${C.muted};white-space:nowrap;vertical-align:top;">${esc(k)}</td><td style="padding:4px 0;font-size:14px;color:${C.ink};">${esc(v)}</td></tr>`
    )
    .join('')

  const bodyHtml = [
    para('New inquiry from the website contact form.'),
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">${rowsHtml}</table>`,
    `<div style="border-top:1px solid ${C.hair};padding-top:12px;font-size:14px;line-height:1.6;color:${C.ink};white-space:pre-wrap;">${esc(inq.message || '')}</div>`
  ].join('')

  const text = [
    'New website inquiry',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    'Message:',
    inq.message || ''
  ].join('\n')

  return {
    subject: `New inquiry: ${inq.subject || 'Website contact'} — ${name}`,
    html: shell({ heading: 'New website inquiry', bodyHtml }),
    text
  }
}

// ── Paid order: helpers ────────────────────────────────────────────────────
function itemOptionText(it) {
  return [it.size && `Size ${it.size}`, it.colour, it.coverage && `${it.coverage} coverage`]
    .filter(Boolean)
    .join(' · ')
}

function shippingLines(shipping) {
  if (!shipping) return []
  return [
    shipping.address1,
    shipping.address2,
    shipping.city,
    shipping.region,
    shipping.postalCode,
    shipping.country
  ].filter(Boolean)
}

/**
 * Normalised order view consumed by the two paid-order builders.
 * @typedef {{
 *   orderNumber: string, firstName: ?string, lastName: ?string,
 *   email: ?string, phone: ?string,
 *   items: Array<{ name:string, quantity:number, size:?string, colour:?string, coverage:?string }>,
 *   totalUsdCents: number, deliveryMethod: string,
 *   shipping: ?{ address1,address2,city,region,postalCode,country }
 * }} OrderView
 */

// ── Paid order: customer confirmation ──────────────────────────────────────
export function orderConfirmationEmail(order = {}) {
  const { orderNumber, firstName, items = [], totalUsdCents, deliveryMethod, shipping } = order
  const hi = firstName ? `Hi ${esc(firstName)},` : 'Hi there,'

  const itemsHtml = items
    .map((it) => {
      const opts = itemOptionText(it)
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid ${C.hair};font-size:14px;color:${C.ink};">${esc(it.name)}${
          opts ? `<br><span style="font-size:12px;color:${C.muted};">${esc(opts)}</span>` : ''
        }</td>
        <td style="padding:8px 0;border-bottom:1px solid ${C.hair};font-size:14px;color:${C.ink};text-align:right;white-space:nowrap;">&times; ${esc(it.quantity)}</td>
      </tr>`
    })
    .join('')

  const ship = shippingLines(shipping)
  const deliveryHtml =
    deliveryMethod === 'shipping' && ship.length
      ? `Shipping to:<br><span style="color:${C.muted};">${esc(ship.join(', '))}</span>`
      : `Pickup — we'll be in touch with the details.`

  const bodyHtml = [
    para(hi),
    para(
      `Thank you! Your payment is confirmed and your order <strong>${esc(orderNumber)}</strong> is now in our hands.`
    ),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;">
      ${itemsHtml}
      <tr>
        <td style="padding:10px 0 0;font-size:14px;font-weight:bold;color:${C.ink};">Total</td>
        <td style="padding:10px 0 0;font-size:14px;font-weight:bold;color:${C.ink};text-align:right;">${esc(usd(totalUsdCents))} USD</td>
      </tr>
    </table>`,
    para(`<span style="font-size:13px;color:${C.muted};">${deliveryHtml}</span>`),
    para(
      `Every piece is made to order — current turnaround is <strong>${TURNAROUND}</strong>, plus delivery time where applicable.`
    ),
    para(`If you need anything at all, just reply to this email.`),
    para(`With love from Grenada,<br><span style="color:${C.accent};">${SITE_NAME}</span>`)
  ].join('')

  const text = [
    hi,
    '',
    `Thank you! Your payment is confirmed and your order ${orderNumber} is now in our hands.`,
    '',
    ...items.map((it) => {
      const opts = itemOptionText(it)
      return `- ${it.name}${opts ? ` (${opts})` : ''} x ${it.quantity}`
    }),
    '',
    `Total: ${usd(totalUsdCents)} USD`,
    '',
    deliveryMethod === 'shipping' && ship.length
      ? `Shipping to: ${ship.join(', ')}`
      : "Pickup — we'll be in touch with the details.",
    '',
    `Every piece is made to order — current turnaround is ${TURNAROUND}, plus delivery time where applicable.`,
    '',
    'If you need anything at all, just reply to this email.',
    '',
    'With love from Grenada,',
    SITE_NAME
  ].join('\n')

  return {
    subject: `Your Bahama Mama order ${orderNumber} is confirmed 🌴`,
    html: shell({
      heading: 'Payment confirmed',
      bodyHtml,
      preheader: `Order ${orderNumber} — made to order, ${TURNAROUND}.`
    }),
    text
  }
}

// ── Paid order: admin notification ─────────────────────────────────────────
export function orderAdminEmail(order = {}, adminUrl) {
  const {
    orderNumber,
    firstName,
    lastName,
    email,
    phone,
    items = [],
    totalUsdCents,
    deliveryMethod,
    shipping
  } = order
  const name = [firstName, lastName].filter(Boolean).join(' ').trim() || '—'
  const ship = shippingLines(shipping)

  const rows = [
    ['Order', orderNumber],
    ['Customer', name],
    ['Email', email || '—'],
    ...(phone ? [['Phone', phone]] : []),
    ['Total', `${usd(totalUsdCents)} USD`],
    [
      'Delivery',
      deliveryMethod === 'shipping'
        ? ship.length
          ? `Shipping — ${ship.join(', ')}`
          : 'Shipping'
        : 'Pickup'
    ]
  ]

  const rowsHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;font-size:13px;color:${C.muted};white-space:nowrap;vertical-align:top;">${esc(k)}</td><td style="padding:4px 0;font-size:14px;color:${C.ink};">${esc(v)}</td></tr>`
    )
    .join('')

  const itemsHtml = items
    .map((it) => {
      const opts = [it.size, it.colour, it.coverage].filter(Boolean).join(' / ')
      return `<li style="margin:0 0 4px;">${esc(it.name)}${opts ? ` — ${esc(opts)}` : ''} &times; ${esc(it.quantity)}</li>`
    })
    .join('')

  const bodyHtml = [
    para('A website order has been paid and verified.'),
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">${rowsHtml}</table>`,
    `<ul style="margin:0 0 14px;padding-left:18px;font-size:14px;line-height:1.5;color:${C.ink};">${itemsHtml}</ul>`,
    adminUrl
      ? para(`<a href="${esc(adminUrl)}" style="color:${C.accent};">View order in admin →</a>`)
      : ''
  ].join('')

  const text = [
    'Website order paid',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    'Items:',
    ...items.map((it) => {
      const opts = [it.size, it.colour, it.coverage].filter(Boolean).join(' / ')
      return `- ${it.name}${opts ? ` — ${opts}` : ''} x ${it.quantity}`
    }),
    ...(adminUrl ? ['', `Admin: ${adminUrl}`] : [])
  ].join('\n')

  return {
    subject: `Paid order ${orderNumber} — ${name}`,
    html: shell({ heading: 'Website order paid', bodyHtml }),
    text
  }
}
