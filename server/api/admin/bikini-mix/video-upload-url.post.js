/**
 * POST /api/admin/bikini-mix/video-upload-url
 *
 * Admin-only. Replaces the old video.post.js (deleted — see git history),
 * which proxied the entire video file through this Nitro/Netlify function
 * before re-uploading it to Supabase Storage. That's what made uploading a
 * real promotional video hang indefinitely: Netlify's synchronous Functions
 * have a request-body limit of only a few MB and an execution timeout of
 * ~10s — nowhere near enough for a video of any real length, even though
 * the bucket itself (and this code's own validation) allowed up to 50MB.
 * Small admin images (<=5MB) happened to stay under that ceiling, which is
 * why those uploads were never reported as broken.
 *
 * This endpoint does none of the heavy lifting itself — it only mints a
 * short-lived Supabase Storage signed UPLOAD url (valid 2 hours, per the
 * SDK) and returns it. The browser then uploads the actual video bytes
 * DIRECTLY to Supabase Storage (composables/useBikiniMixMediaUpload.js),
 * never through this server at all, so there's no Netlify payload/timeout
 * limit in the path for the file itself.
 *
 * Size is NOT (and can't be) checked here — this request carries no file
 * data, just the intended content-type, so there's nothing to measure yet.
 * Enforcement for size and MIME type happens at two layers instead:
 *   1. Client-side, before the upload starts (fast feedback, not a
 *      security boundary).
 *   2. The 'bikini-mix-media' bucket's own file_size_limit (50MB) and
 *      allowed_mime_types, enforced by Supabase Storage itself on the
 *      signed-URL upload request — the real, authoritative check, applied
 *      regardless of what the client claims.
 */
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { BIKINI_MIX_MEDIA_BUCKET, BIKINI_MIX_VIDEO_TYPES, bikiniMixVideoExtForMime } from '../../../utils/bikiniMixMedia.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const contentType = body?.contentType

  if (!BIKINI_MIX_VIDEO_TYPES.includes(contentType)) {
    setResponseStatus(event, 400)
    return { error: 'Please choose an MP4, WebM or MOV video.' }
  }

  const path = `${randomUUID()}.${bikiniMixVideoExtForMime(contentType)}`

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase.storage.from(BIKINI_MIX_MEDIA_BUCKET).createSignedUploadUrl(path, { upsert: false })

    if (error) {
      console.error('[admin/bikini-mix/video-upload-url] sign failed:', error.message)
      setResponseStatus(event, 500)
      return {
        error: /bucket.*not.*found/i.test(error.message || '')
          ? 'The bikini-mix-media Storage bucket has not been created yet.'
          : 'Could not prepare the upload. Please try again.'
      }
    }

    // Pure string construction (no network call) — safe to compute now,
    // before the file is actually uploaded, since the path is already fixed.
    const { data: publicUrlData } = supabase.storage.from(BIKINI_MIX_MEDIA_BUCKET).getPublicUrl(path)

    return { signedUrl: data.signedUrl, token: data.token, path: data.path, publicUrl: publicUrlData.publicUrl }
  } catch (err) {
    console.error('[admin/bikini-mix/video-upload-url] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not prepare the upload. Please try again.' }
  }
})
