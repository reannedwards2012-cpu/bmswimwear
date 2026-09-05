/**
 * Safe-field mapping for admin order responses. Shared by the list, detail
 * and status-update endpoints so the exposed shape can't drift between them.
 *
 * Never selected/returned here: payment_callback_token, checkout_idempotency_key,
 * go2pay_request_id, go2pay_order_id, go2pay_payment_url, payment_provider,
 * user_id. `payment_id` is the one Go2Pay-related field allowed through, for
 * admin troubleshooting only.
 *
 * `admin_notes` is admin-only (private, internal) — distinct from `notes`
 * (the customer's own order note). It must NEVER be added to any
 * customer-facing response (checkout, /api/account/orders, etc.) — only
 * this admin detail/status select and server/api/admin/orders/[id]/notes.patch.js
 * ever touch it.
 *
 * ── Currency ──────────────────────────────────────────────────────────────
 * `currency` is 'USD' (every website order + USD manual orders) or 'XCD'
 * (XCD manual orders). Exactly one of `subtotal_usd_cents` / `subtotal_xcd_cents`
 * is populated — the one matching `currency`. Same rule for the item-level
 * `unit_price_*_cents`. No conversion is ever performed.
 *
 * ── Status actions ────────────────────────────────────────────────────────
 * `mapOrderDetail` returns `isManual` and the authoritative `availableTransitions`
 * list (from `adminTransitionsFor(source, status)`) so the admin detail page
 * renders exactly the actions the server will accept — it must not re-derive
 * the rules from a client-side copy of the transition maps (that drifts, and
 * silently shows the wrong action set if the client's view of `source` is
 * ever stale/missing). The status PATCH endpoint still re-validates every
 * transition regardless.
 */
import { adminTransitionsFor, isManualSource } from './orderStatus.js'
export const ORDER_DETAIL_SELECT = `
  id, order_number, created_at, updated_at, status, paid_at, archived_at,
  source, currency, payment_method, subtotal_usd_cents, subtotal_xcd_cents,
  first_name, last_name, email, phone,
  delivery_method, shipping_country, shipping_address1, shipping_address2,
  shipping_city, shipping_region, shipping_postal_code,
  notes, admin_notes, payment_id,
  order_items ( product_name, image, description, is_custom, quantity, size, colour_name, coverage, unit_price_usd_cents, unit_price_xcd_cents )
`.trim()

// Light select for the admin list + dashboard recentOrders.
export const ORDER_LIST_SELECT = `
  id, order_number, created_at, first_name, last_name, email, status, paid_at, archived_at,
  source, currency, delivery_method, subtotal_usd_cents, subtotal_xcd_cents
`.trim()

export const formatOrderNumber = (n) => `BM-${String(n).padStart(6, '0')}`

export function mapOrderListItem(o) {
  return {
    id: o.id,
    orderNumber: formatOrderNumber(o.order_number),
    createdAt: o.created_at,
    firstName: o.first_name,
    lastName: o.last_name,
    email: o.email,
    source: o.source,
    currency: o.currency,
    subtotalUsdCents: o.subtotal_usd_cents,
    subtotalXcdCents: o.subtotal_xcd_cents,
    status: o.status,
    deliveryMethod: o.delivery_method,
    paidAt: o.paid_at,
    archivedAt: o.archived_at ?? null
  }
}

export function mapOrderDetail(o) {
  return {
    id: o.id,
    orderNumber: formatOrderNumber(o.order_number),
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    status: o.status,
    paidAt: o.paid_at,
    archivedAt: o.archived_at ?? null,
    source: o.source,
    isManual: isManualSource(o.source),
    availableTransitions: adminTransitionsFor(o.source, o.status),
    currency: o.currency,
    paymentMethod: o.payment_method ?? null,
    subtotalUsdCents: o.subtotal_usd_cents,
    subtotalXcdCents: o.subtotal_xcd_cents,
    customer: {
      firstName: o.first_name,
      lastName: o.last_name,
      email: o.email,
      phone: o.phone
    },
    delivery: {
      deliveryMethod: o.delivery_method,
      shippingCountry: o.shipping_country,
      shippingAddress1: o.shipping_address1,
      shippingAddress2: o.shipping_address2,
      shippingCity: o.shipping_city,
      shippingRegion: o.shipping_region,
      shippingPostalCode: o.shipping_postal_code
    },
    notes: o.notes,
    adminNotes: o.admin_notes,
    paymentId: o.payment_id,
    items: (o.order_items ?? []).map((it) => ({
      productName: it.product_name,
      image: it.image,
      description: it.description ?? null,
      isCustom: it.is_custom ?? false,
      quantity: it.quantity,
      size: it.size,
      colourName: it.colour_name,
      coverage: it.coverage,
      unitPriceUsdCents: it.unit_price_usd_cents,
      unitPriceXcdCents: it.unit_price_xcd_cents
    }))
  }
}
