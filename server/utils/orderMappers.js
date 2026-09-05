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
 */
export const ORDER_DETAIL_SELECT = `
  id, order_number, created_at, updated_at, status, paid_at, subtotal_usd_cents,
  first_name, last_name, email, phone,
  delivery_method, shipping_country, shipping_address1, shipping_address2,
  shipping_city, shipping_region, shipping_postal_code,
  notes, admin_notes, payment_id,
  order_items ( product_name, image, quantity, size, colour_name, coverage, unit_price_usd_cents )
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
    subtotalUsdCents: o.subtotal_usd_cents,
    status: o.status,
    deliveryMethod: o.delivery_method,
    paidAt: o.paid_at
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
    subtotalUsdCents: o.subtotal_usd_cents,
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
      quantity: it.quantity,
      size: it.size,
      colourName: it.colour_name,
      coverage: it.coverage,
      unitPriceUsdCents: it.unit_price_usd_cents
    }))
  }
}
