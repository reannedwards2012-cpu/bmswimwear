/**
 * Reference-image Storage helpers for manual/custom order items. Mirrors
 * server/utils/productImages.js, with order-prefixed export names so Nitro
 * server auto-imports don't collide with the product/fabric helpers.
 *
 * Bucket: 'order-images' (Phase 2: private — was public-read; admin-only
 * write either way). Writes/deletes go through supabaseAdmin() (service
 * role); the browser never touches Storage directly. UUID filenames make
 * enumeration infeasible, but that stopped being the only protection once
 * the bucket went private — a signed URL is now required to view anything,
 * minted only via signOrderImageUrl() below, itself only ever called with a
 * path this server already resolved from an id-scoped, admin-gated row (a
 * client never supplies the path/bucket for viewing). The stored URL still
 * lives on `order_items.image` in its old "public URL" shape (unchanged —
 * no DB/data migration needed; see the module comment in
 * server/utils/signedImageUrl.js) and is returned ONLY by admin order
 * APIs, as a freshly-signed URL — never by any public storefront endpoint,
 * and never as the raw/permanent form.
 */
import { createSignedStorageUrl } from './signedImageUrl.js'

export const ORDER_IMAGE_BUCKET = 'order-images'
export const ORDER_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const ORDER_IMAGE_MAX_BYTES = 5 * 1024 * 1024 // 5 MiB

// Admin order-detail viewing: generous enough that a normal single review
// session never sees a broken thumbnail; a manual page reload always mints
// a fresh one regardless.
export const ORDER_IMAGE_SIGNED_URL_TTL_SECONDS = 30 * 60
// The "just uploaded, not yet saved" preview on the manual-order create
// form — longer, since there's no reload-to-recover path on an unsaved
// draft (reloading would lose the whole form).
export const ORDER_IMAGE_UPLOAD_PREVIEW_TTL_SECONDS = 60 * 60

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

/**
 * The only way an order item's image is ever rendered after Phase 2: given
 * the stored (old-shape) URL, extract its own object path and mint a
 * short-lived signed URL. Returns null for no-image / unrecognized values —
 * callers show "no image" rather than crash.
 */
export async function signOrderImageUrl(supabase, storedUrl, expiresInSeconds = ORDER_IMAGE_SIGNED_URL_TTL_SECONDS) {
  const path = orderImagePathFromPublicUrl(storedUrl)
  return createSignedStorageUrl(supabase, ORDER_IMAGE_BUCKET, path, expiresInSeconds)
}
