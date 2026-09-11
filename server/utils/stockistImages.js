/**
 * Stockist inventory item photo Storage helpers — mirrors
 * server/utils/productImages.js exactly, against its own bucket so the two
 * stay independently manageable. See the migration file's footer
 * (supabase/migrations/20260911120000_stockists.sql) for how to create it.
 *
 * Bucket: 'stockist-item-images' (public-read, admin-only write). All writes
 * go through supabaseAdmin() (service role); the browser never talks to
 * Storage directly.
 */
export const STOCKIST_IMAGE_BUCKET = 'stockist-item-images'
export const STOCKIST_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const STOCKIST_IMAGE_MAX_BYTES = 5 * 1024 * 1024 // 5 MiB

const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export const stockistImageExtForMime = (mime) => EXT_BY_MIME[mime] || 'bin'
