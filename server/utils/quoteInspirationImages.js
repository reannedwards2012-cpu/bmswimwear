/**
 * Quote inspiration-image Storage helpers — the bucket-specific pieces
 * only. Image type/size limits and the mime->extension helper are NOT
 * redeclared here: import ALLOWED_IMAGE_TYPES/MAX_IMAGE_BYTES/extForMime
 * straight from fabricImages.js (identical limits, no reason to duplicate
 * — re-exporting them here would also trip a server/utils auto-import
 * name collision).
 *
 * Bucket: 'quote-inspiration-images' (Phase 2: private — was public-read;
 * admin-only write either way). All writes go through supabaseAdmin()
 * (service role), which bypasses Storage RLS entirely regardless of the
 * bucket's public/private setting. The bucket is hand-created/toggled in
 * the Supabase dashboard (see the migration's trailing comment) — never
 * via SQL. Viewing now requires a signed URL minted by
 * signQuoteInspirationImageUrl(s) below, itself only ever called with
 * path(s) this server already resolved from an id-scoped, admin-gated
 * quote row — a client never supplies the path/bucket for viewing.
 */
import { createSignedStorageUrl } from './signedImageUrl.js'

export const QUOTE_INSPIRATION_IMAGE_BUCKET = 'quote-inspiration-images'

// Admin quote-detail viewing — same reasoning as ORDER_IMAGE_SIGNED_URL_TTL_SECONDS.
export const QUOTE_INSPIRATION_SIGNED_URL_TTL_SECONDS = 30 * 60
// "Just uploaded, not yet saved" preview in the Quote Calculator form.
export const QUOTE_INSPIRATION_UPLOAD_PREVIEW_TTL_SECONDS = 60 * 60

const PUBLIC_URL_MARKER = `/storage/v1/object/public/${QUOTE_INSPIRATION_IMAGE_BUCKET}/`

/**
 * Extract the Storage object path from one of our own quote-inspiration-
 * images public URLs. Returns null for anything else — used only for
 * best-effort cleanup, never trusted for anything security-sensitive.
 */
export function pathFromQuoteInspirationPublicUrl(url) {
  if (typeof url !== 'string') return null
  const idx = url.indexOf(PUBLIC_URL_MARKER)
  if (idx === -1) return null
  const path = url.slice(idx + PUBLIC_URL_MARKER.length).split(/[?#]/)[0]
  return path || null
}

/** One stored (old-shape) URL -> a short-lived signed URL, or null. */
export async function signQuoteInspirationImageUrl(supabase, storedUrl, expiresInSeconds = QUOTE_INSPIRATION_SIGNED_URL_TTL_SECONDS) {
  const path = pathFromQuoteInspirationPublicUrl(storedUrl)
  return createSignedStorageUrl(supabase, QUOTE_INSPIRATION_IMAGE_BUCKET, path, expiresInSeconds)
}

/**
 * The full inspirationImageUrls array -> a parallel array of signed URLs,
 * same length/order. Used alongside (never instead of) the canonical
 * array, since the Quote Calculator form re-submits the canonical values
 * on save — substituting signed URLs in place would corrupt stored data.
 */
export async function signQuoteInspirationImageUrls(supabase, storedUrls, expiresInSeconds = QUOTE_INSPIRATION_SIGNED_URL_TTL_SECONDS) {
  const list = Array.isArray(storedUrls) ? storedUrls : []
  return Promise.all(list.map((u) => signQuoteInspirationImageUrl(supabase, u, expiresInSeconds)))
}
