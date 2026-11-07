/**
 * Uploads a file DIRECTLY from the browser to Supabase Storage using a
 * short-lived signed upload URL minted by a lightweight server endpoint
 * (server/api/admin/bikini-mix/video-upload-url.post.js) — the file bytes
 * never pass through our own Nitro/Netlify function, which is what made
 * large video uploads hang indefinitely (Netlify's synchronous Functions
 * have only a few MB of request-body headroom and a ~10s timeout).
 *
 * The signed token IS the authorization for this one upload — Supabase's
 * own docs describe it as usable "without further authentication" — so
 * this deliberately builds its own minimal client from the public
 * (publishable-key) runtime config rather than reusing the authenticated
 * session client from useAuth.js; no signed-in session is needed to
 * consume a token that's already scoped to one exact path.
 */
import { createClient } from '@supabase/supabase-js'

let _client = null
function getUploadClient() {
  if (_client) return _client
  const { supabaseUrl, supabaseKey } = useRuntimeConfig().public
  _client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  return _client
}

/**
 * Rejects after `ms` if `promise` hasn't settled by then, so the caller
 * (the admin's "Uploading…" UI) is guaranteed to stop waiting.
 *
 * Supabase's uploadToSignedUrl() exposes no AbortSignal/cancellation option
 * at all — confirmed directly against the installed SDK's type definitions
 * (FileOptions has cacheControl/contentType/upsert/duplex, nothing for
 * abort). So the underlying browser request genuinely CAN'T be cancelled
 * here; it may keep running after this function has already rejected.
 * What this DOES guarantee instead: that late settlement is always safely
 * handled —
 *   - a late REJECTION is caught here, not left as an unhandled promise
 *     rejection in the browser console (onLateSettle receives it for
 *     visibility; nothing in the UI ever acts on it, since the caller has
 *     already moved on by then).
 *   - a late SUCCESS is also caught and reported the same way — the file
 *     did reach Storage, but under a path nothing references yet (the
 *     admin saw a timeout error and the form never got that URL), so it's
 *     an orphaned-but-harmless object, same risk profile as every other
 *     "upload succeeded, something after it failed" case in this codebase
 *     — never silently corrupts any already-moved-on UI state.
 */
function withTimeout(promise, ms, message, onLateSettle) {
  return new Promise((resolve, reject) => {
    // Deliberately a single Promise with one executor, rather than
    // Promise.race([promise, timeoutPromise]) — that earlier shape created
    // a second, independently-rejecting promise object (the timeout one),
    // which is what the fake-timer-driven test run below was correctly
    // flagging as unhandled: this executor's own reject() is the only
    // rejection path that ever exists, and it's always handled, since the
    // caller already awaits the promise this function returns.
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error(message))
    }, ms)

    promise.then(
      (result) => {
        if (settled) { onLateSettle?.({ ok: true, result }); return }
        settled = true
        clearTimeout(timer)
        resolve(result)
      },
      (err) => {
        if (settled) { onLateSettle?.({ ok: false, error: err }); return }
        settled = true
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

export function useBikiniMixMediaUpload() {
  /**
   * @param {string} bucket
   * @param {string} path
   * @param {string} token      from createSignedUploadUrl()
   * @param {File} file
   * @param {{ contentType?: string, timeoutMs?: number }} [options]
   */
  async function uploadToSignedUrl(bucket, path, token, file, options = {}) {
    const { contentType, timeoutMs = 5 * 60 * 1000 } = options
    const client = getUploadClient()
    const upload = client.storage.from(bucket).uploadToSignedUrl(path, token, file, { contentType: contentType || file.type })
    const { error } = await withTimeout(
      upload,
      timeoutMs,
      'Upload timed out — please check your connection and try again.',
      (outcome) => {
        if (outcome.ok) console.warn(`[bikini-mix video] upload for "${path}" finished AFTER the timeout had already given up — the file reached Storage but the form was never updated with it.`)
        else console.warn(`[bikini-mix video] upload for "${path}" failed AFTER the timeout had already given up:`, outcome.error?.message)
      }
    )
    if (error) throw error
  }

  return { uploadToSignedUrl }
}
