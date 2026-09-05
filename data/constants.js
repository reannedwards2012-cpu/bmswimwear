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
