/**
 * Small app-wide constants that used to live in data/products.js but have
 * nothing to do with the (now Supabase-backed) product catalogue.
 *
 * `data/products.js` is retired as a runtime source — everything product-
 * related is read from Supabase via /api/products* now — but these two
 * values are still needed in several components, so they get a clean home
 * here, decoupled from the retired file.
 */

// The four product categories. This is the single canonical form — the exact
// string stored in `products.category`, used verbatim as both the filter
// value and the display label everywhere (storefront filter pills, admin
// category <select>, the fabric form's compatibility grouping). No separate
// slug/label pair — the product slug already provides the URL-safe id.
export const CATEGORIES = ['Tops', 'Bottoms', 'One Pieces', 'Cover Ups']

// Every piece is made to order — one turnaround, not per-product.
export const MADE_TO_ORDER = { turnaround: '10–14 business days' }

// Contact / custom-order inquiry subjects. Shared by the public contact form
// <select> and the server-side inquiry validation (server/utils/inquiryValidation.js).
// The stored `inquiries.subject` is the display string itself (same approach as
// `products.category`) — no separate slug/label pair. An incoming subject not
// in this list is coerced to 'Other' server-side.
export const INQUIRY_SUBJECTS = [
  'Custom / bespoke design',
  'Sizing & fit help',
  'An existing order',
  'Wholesale',
  'Just saying hi',
  'Other'
]

// Short deep-link slugs → subject label, for links like /contact?subject=custom
// (the "Start a custom order" CTAs). Only the pairs we actually link to.
export const INQUIRY_SUBJECT_SLUGS = {
  custom: 'Custom / bespoke design'
}
