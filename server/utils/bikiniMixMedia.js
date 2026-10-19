/**
 * Bikini Mix promo video Storage helpers — same hand-created-bucket pattern
 * as server/utils/productImages.js / fabricImages.js / stockistImages.js,
 * except this bucket holds video, not images.
 *
 * Bucket: 'bikini-mix-media' (public-read, admin-only write). See the
 * migration file's footer for how to create it.
 */
export const BIKINI_MIX_MEDIA_BUCKET = 'bikini-mix-media'
export const BIKINI_MIX_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
// Matches the bucket's own file_size_limit (the project's plan rejected an
// 80 MiB bucket limit at creation time with a 413, so 50 MiB is the real
// ceiling Storage enforces) — kept in sync so this check never passes
// something the upload itself would then reject.
export const BIKINI_MIX_VIDEO_MAX_BYTES = 50 * 1024 * 1024 // 50 MiB

const EXT_BY_MIME = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' }
export const bikiniMixVideoExtForMime = (mime) => EXT_BY_MIME[mime] || 'bin'

const PUBLIC_URL_MARKER = `/storage/v1/object/public/${BIKINI_MIX_MEDIA_BUCKET}/`

/** Extract the Storage object path from one of our own public URLs. Best-effort cleanup only. */
export function bikiniMixMediaPathFromPublicUrl(url) {
  if (typeof url !== 'string') return null
  const idx = url.indexOf(PUBLIC_URL_MARKER)
  if (idx === -1) return null
  const path = url.slice(idx + PUBLIC_URL_MARKER.length).split(/[?#]/)[0]
  return path || null
}
