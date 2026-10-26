/**
 * Quote inspiration-image Storage helpers — the bucket-specific pieces
 * only. Image type/size limits and the mime->extension helper are NOT
 * redeclared here: import ALLOWED_IMAGE_TYPES/MAX_IMAGE_BYTES/extForMime
 * straight from fabricImages.js (identical limits, no reason to duplicate
 * — re-exporting them here would also trip a server/utils auto-import
 * name collision).
 *
 * Bucket: 'quote-inspiration-images' (public-read, admin-only write). All
 * writes go through supabaseAdmin() (service role), which bypasses Storage
 * RLS. The bucket is hand-created in the Supabase dashboard (see the
 * migration's trailing comment) — never via SQL.
 */
export const QUOTE_INSPIRATION_IMAGE_BUCKET = 'quote-inspiration-images'

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
