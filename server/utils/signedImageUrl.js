/**
 * Phase 2 security hardening — generic short-lived signed-URL helper for
 * private Storage buckets. Used by orderImages.js / quoteInspirationImages.js
 * (bucket name + path passed in; each bucket's own file still owns its
 * public-URL-shape path-extraction logic — this helper doesn't duplicate
 * that, it only wraps the actual signing call they share).
 *
 * Never throws — a broken/expired/missing Storage object degrades to "no
 * image" on the page, not a crashed admin request. Never logs the signed
 * URL itself (it's a bearer credential for the file for its whole TTL).
 */
export async function createSignedStorageUrl(supabase, bucket, path, expiresInSeconds) {
  if (!path) return null
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds)
    if (error) {
      console.error(`[signed-url] ${bucket}: could not sign object (path omitted from log):`, error.message)
      return null
    }
    return data?.signedUrl ?? null
  } catch (err) {
    console.error(`[signed-url] ${bucket}: unexpected error while signing:`, err?.message)
    return null
  }
}
