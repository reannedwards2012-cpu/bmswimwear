/**
 * Server-side validation + authoritative building of a MANUAL order
 * (Instagram / WhatsApp / in-person / other). Pure module — no Nitro /
 * Supabase imports — so it can be unit-tested directly. The caller
 * (server/api/admin/orders/index.post.js) fetches the product catalogue and
 * passes it in.
 *
 * Nothing from the payload is trusted for the order total: it is
 * server-computed from the final item snapshots, in the order's own
 * currency. No currency conversion is ever performed.
 *
 * Currency: 'XCD' (default) or 'USD'. The order total goes in
 * subtotal_xcd_cents OR subtotal_usd_cents (the other stays null — never a
 * fake zero); item snapshots likewise carry only the used currency's unit
 * price.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_QTY = 99
const MAX = { name: 120, email: 200, phone: 40, notes: 2000, itemName: 200, description: 4000, freeText: 120, url: 500 }

const MANUAL_SOURCES = ['instagram', 'whatsapp', 'in_person', 'other']
const CURRENCIES = ['USD', 'XCD']
const PAYMENT_METHODS = ['cash', 'bank_transfer', 'payment_link', 'other']

const str = (v) => (typeof v === 'string' ? v.trim() : '')
const orNull = (s) => (s ? s : null)

/**
 * Normalise a phone to "+<digits>" or "<digits>" — drop spaces, dashes,
 * brackets and dots, keep a single leading "+". Manual orders (often just an
 * Instagram handle + a number) are frequently searched by phone, and the
 * order-list search matches on a bare digit run, so storing the digit run is
 * what makes that search actually work. Still perfectly readable.
 */
const normalisePhone = (raw) => {
  const s = str(raw)
  if (!s) return ''
  const plus = s.startsWith('+') ? '+' : ''
  return plus + s.replace(/\D/g, '')
}

function intOrNull(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : NaN
}

/**
 * A date-string → an ISO timestamp. If the date is "today" (UTC or Grenada
 * local, to be safe near midnight) we stamp the real current time, so
 * several orders logged today still sort correctly; a past date is stamped
 * at noon UTC (= 8am AST — start of the business day, and safely inside that
 * calendar day for the -4h dashboard period logic).
 */
export function resolveTimestamp(dateStr) {
  const now = new Date()
  const utcToday = now.toISOString().slice(0, 10)
  const bzToday = new Date(now.getTime() - 4 * 3600 * 1000).toISOString().slice(0, 10)
  if (dateStr === utcToday || dateStr === bzToday) return now.toISOString()
  return `${dateStr}T12:00:00.000Z`
}

/**
 * @param {object} payload
 * @param {Map<string, object>} catalogue  slug -> { id, title, image, price, priceXcd, sizes[], coverage[], colours:[{id,name}] }
 * @returns {{ ok:false, error:string, issues:string[] }}
 *        | {{ ok:true, orderRow:object, itemRows:object[], totalCents:number, currency:string }}
 */
export function buildManualOrder(payload, catalogue) {
  const issues = []
  const p = payload && typeof payload === 'object' ? payload : {}
  const cat = catalogue instanceof Map ? catalogue : new Map()

  // ── source / currency ──
  const source = str(p.source)
  if (!MANUAL_SOURCES.includes(source)) {
    issues.push(`Source must be one of: ${MANUAL_SOURCES.join(', ')}.`)
  }
  const currency = CURRENCIES.includes(str(p.currency)) ? str(p.currency) : 'XCD'

  // ── customer ──
  const firstName = str(p.firstName)
  const lastName = str(p.lastName)
  const email = str(p.email)
  const phone = normalisePhone(p.phone)
  if (!firstName) issues.push('Enter a first name.')
  if (firstName.length > MAX.name || lastName.length > MAX.name) issues.push('A name field is too long.')
  if (email && (!EMAIL_RE.test(email) || email.length > MAX.email)) issues.push('Enter a valid email address, or leave it blank.')
  if (phone.length > MAX.phone) issues.push('Phone number is too long.')

  // ── order date ──
  const orderDate = DATE_RE.test(str(p.orderDate)) ? str(p.orderDate) : new Date().toISOString().slice(0, 10)
  if (str(p.orderDate) && !DATE_RE.test(str(p.orderDate))) issues.push('Order date must be a valid YYYY-MM-DD date.')

  // ── notes ──
  const notes = str(p.notes)
  const adminNotes = str(p.adminNotes)
  if (notes.length > MAX.notes) issues.push('Order notes are too long.')
  if (adminNotes.length > MAX.notes) issues.push('Admin notes are too long.')

  // ── payment ──
  const pay = p.payment && typeof p.payment === 'object' ? p.payment : {}
  const markPaid = pay.markPaid === true
  let paymentDate = null
  let paymentMethod = null
  if (markPaid) {
    paymentDate = DATE_RE.test(str(pay.paymentDate)) ? str(pay.paymentDate) : new Date().toISOString().slice(0, 10)
    if (str(pay.paymentDate) && !DATE_RE.test(str(pay.paymentDate))) issues.push('Payment date must be a valid YYYY-MM-DD date.')
    if (pay.paymentMethod != null && pay.paymentMethod !== '') {
      const pm = str(pay.paymentMethod)
      if (!PAYMENT_METHODS.includes(pm)) issues.push(`Payment method must be one of: ${PAYMENT_METHODS.join(', ')}.`)
      else paymentMethod = pm
    }
  }

  // ── items ──
  const rawItems = Array.isArray(p.items) ? p.items : []
  if (rawItems.length === 0) issues.push('Add at least one item.')

  const itemRows = []
  let totalCents = 0

  rawItems.forEach((raw, i) => {
    const item = raw && typeof raw === 'object' ? raw : {}
    const n = i + 1
    const type = str(item.type) === 'custom' ? 'custom' : 'catalogue'

    let quantity = intOrNull(item.quantity)
    if (quantity === null) quantity = 1
    if (Number.isNaN(quantity) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) {
      issues.push(`Item ${n}: quantity must be a whole number between 1 and ${MAX_QTY}.`)
      return
    }

    let priceCents = intOrNull(item.priceCents)

    if (type === 'custom') {
      const name = str(item.name)
      if (!name) {
        issues.push(`Item ${n}: a custom item needs a name.`)
        return
      }
      if (name.length > MAX.itemName) issues.push(`Item ${n}: name is too long.`)
      const description = str(item.description)
      if (description.length > MAX.description) issues.push(`Item ${n}: description is too long.`)
      if (priceCents === null || Number.isNaN(priceCents) || !Number.isInteger(priceCents) || priceCents < 0) {
        issues.push(`Item ${n}: a custom item needs a price (whole ${currency} cents ≥ 0).`)
        return
      }
      const imageUrl = str(item.imageUrl)
      if (imageUrl.length > MAX.url) issues.push(`Item ${n}: image URL is too long.`)

      itemRows.push({
        product_id: null,
        product_name: name,
        image: orNull(imageUrl),
        description: orNull(description),
        is_custom: true,
        quantity,
        size: orNull(str(item.size).slice(0, MAX.freeText)),
        colour_id: null,
        colour_name: orNull(str(item.colour).slice(0, MAX.freeText)),
        coverage: orNull(str(item.coverage).slice(0, MAX.freeText)),
        unit_price_usd_cents: currency === 'USD' ? priceCents : null,
        unit_price_xcd_cents: currency === 'XCD' ? priceCents : null
      })
      totalCents += priceCents * quantity
      return
    }

    // ── catalogue item ──
    const productId = str(item.productId)
    const product = cat.get(productId)
    if (!productId || !product) {
      issues.push(`Item ${n}: "${productId || '(none)'}" is not an active product.`)
      return
    }
    const size = item.size == null ? '' : str(item.size)
    const colourId = item.colourId == null ? '' : str(item.colourId)
    const coverage = item.coverage == null ? '' : str(item.coverage)

    if (product.sizes.length > 0) {
      if (!size) issues.push(`Item ${n} (${product.title}): choose a size.`)
      else if (!product.sizes.includes(size)) issues.push(`Item ${n}: "${size}" is not a size for ${product.title}.`)
    } else if (size) {
      issues.push(`Item ${n}: ${product.title} has no size options.`)
    }

    let colourName = null
    if (product.colours.length > 0) {
      if (!colourId) issues.push(`Item ${n} (${product.title}): choose a fabric/colour.`)
      else {
        const match = product.colours.find((c) => c.id === colourId)
        if (!match) issues.push(`Item ${n}: that fabric is not available for ${product.title}.`)
        else colourName = match.name
      }
    } else if (colourId) {
      issues.push(`Item ${n}: ${product.title} has no fabric options.`)
    }

    if (product.coverage.length > 0) {
      if (!coverage) issues.push(`Item ${n} (${product.title}): choose a coverage.`)
      else if (!product.coverage.includes(coverage)) issues.push(`Item ${n}: "${coverage}" is not a coverage for ${product.title}.`)
    } else if (coverage) {
      issues.push(`Item ${n}: ${product.title} has no coverage options.`)
    }

    // price: override if given & valid, else the catalogue price in this currency
    if (priceCents === null) {
      priceCents = Math.round((currency === 'XCD' ? product.priceXcd : product.price) * 100)
    } else if (Number.isNaN(priceCents) || !Number.isInteger(priceCents) || priceCents < 0) {
      issues.push(`Item ${n}: price must be whole ${currency} cents ≥ 0.`)
      return
    }

    itemRows.push({
      product_id: product.id,
      product_name: product.title,
      image: product.image ?? null,
      description: null,
      is_custom: false,
      quantity,
      size: orNull(size),
      colour_id: orNull(colourId),
      colour_name: colourName,
      coverage: orNull(coverage),
      unit_price_usd_cents: currency === 'USD' ? priceCents : null,
      unit_price_xcd_cents: currency === 'XCD' ? priceCents : null
    })
    totalCents += priceCents * quantity
  })

  if (issues.length > 0) {
    return { ok: false, error: 'Some order details are missing or invalid.', issues }
  }

  const createdAt = resolveTimestamp(orderDate)
  const paidAt = markPaid ? resolveTimestamp(paymentDate) : null

  const orderRow = {
    source,
    currency,
    first_name: firstName,
    last_name: orNull(lastName),
    email: orNull(email),
    phone: orNull(phone),
    delivery_method: 'pickup',
    notes: orNull(notes),
    admin_notes: orNull(adminNotes),
    created_at: createdAt,
    updated_at: createdAt,
    status: markPaid ? 'paid' : 'pending',
    paid_at: paidAt,
    payment_method: markPaid ? paymentMethod : null,
    payment_provider: null,
    payment_id: null,
    user_id: null,
    subtotal_usd_cents: currency === 'USD' ? totalCents : null,
    subtotal_xcd_cents: currency === 'XCD' ? totalCents : null
  }

  return { ok: true, orderRow, itemRows, totalCents, currency }
}
