/**
 * Fabric image Storage helpers — shared by the admin upload/delete endpoints.
 *
 * Bucket: 'fabric-images' (public-read, admin-only write). All writes go
 * through supabaseAdmin() (service role), which bypasses Storage RLS the
 * same way it bypasses table RLS — the browser never talks to Storage
 * directly. Public read works because the bucket itself is marked "Public"
 * in Supabase (bypasses RLS for the public object URL route); no anon
 * Storage policy is required.
 */
export const FABRIC_IMAGE_BUCKET = 'fabric-images'
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB

const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export const extForMime = (mime) => EXT_BY_MIME[mime] || 'bin'

const PUBLIC_URL_MARKER = `/storage/v1/object/public/${FABRIC_IMAGE_BUCKET}/`

/**
 * Extract the Storage object path from one of our own fabric-images public
 * URLs. Returns null for anything else (a different host, a different
 * bucket, not a string) — used only for best-effort cleanup, never trusted
 * for anything security-sensitive.
 */
export function pathFromPublicUrl(url) {
  if (typeof url !== 'string') return null
  const idx = url.indexOf(PUBLIC_URL_MARKER)
  if (idx === -1) return null
  const path = url.slice(idx + PUBLIC_URL_MARKER.length).split(/[?#]/)[0]
  return path || null
}
