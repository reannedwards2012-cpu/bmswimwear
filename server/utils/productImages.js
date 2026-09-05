/**
 * Product image Storage helpers — shared by the admin product image
 * endpoints. Same idea as server/utils/fabricImages.js, but with
 * product-prefixed export names so Nitro's server auto-imports don't collide
 * with the fabric helpers (the endpoints import explicitly regardless).
 *
 * Bucket: 'product-images' (public-read, admin-only write). All writes go
 * through supabaseAdmin() (service role); the browser never talks to Storage
 * directly.
 *
 * NOTE: the 14 existing catalogue products keep their original static image
 * paths ('/images/products/<slug>/01.jpg', served from /public) — those were
 * NOT migrated into Storage. `product_images.image_url` holds whichever kind
 * of URL applies. `productImagePathFromPublicUrl` returns null for a legacy
 * static path, so Storage cleanup simply skips those.
 */
export const PRODUCT_IMAGE_BUCKET = 'product-images'
export const PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024 // 5 MiB

const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export const productExtForMime = (mime) => EXT_BY_MIME[mime] || 'bin'

const PUBLIC_URL_MARKER = `/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/`

/**
 * Extract the Storage object path from one of our own product-images public
 * URLs. Returns null for anything else (a legacy static path, a different
 * bucket/host, not a string) — best-effort cleanup only.
 */
export function productImagePathFromPublicUrl(url) {
  if (typeof url !== 'string') return null
  const idx = url.indexOf(PUBLIC_URL_MARKER)
  if (idx === -1) return null
  const path = url.slice(idx + PUBLIC_URL_MARKER.length).split(/[?#]/)[0]
  return path || null
}
