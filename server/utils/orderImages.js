/**
 * Reference-image Storage helpers for manual/custom order items. Mirrors
 * server/utils/productImages.js, with order-prefixed export names so Nitro
 * server auto-imports don't collide with the product/fabric helpers.
 *
 * Bucket: 'order-images' (public-read, admin-only write). Writes/deletes go
 * through supabaseAdmin() (service role); the browser never touches Storage.
 * UUID filenames make enumeration infeasible. The stored URL lives on
 * `order_items.image` and is returned ONLY by admin order APIs — never by
 * any public storefront endpoint.
 */
export const ORDER_IMAGE_BUCKET = 'order-images'
export const ORDER_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const ORDER_IMAGE_MAX_BYTES = 5 * 1024 * 1024 // 5 MiB

const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export const orderExtForMime = (mime) => EXT_BY_MIME[mime] || 'bin'

const PUBLIC_URL_MARKER = `/storage/v1/object/public/${ORDER_IMAGE_BUCKET}/`

/**
 * Storage object path from one of our own order-images public URLs, or null
 * for anything else (a catalogue static path, a different bucket, not a
 * string) — best-effort cleanup only.
 */
export function orderImagePathFromPublicUrl(url) {
  if (typeof url !== 'string') return null
  const idx = url.indexOf(PUBLIC_URL_MARKER)
  if (idx === -1) return null
  const path = url.slice(idx + PUBLIC_URL_MARKER.length).split(/[?#]/)[0]
  return path || null
}
