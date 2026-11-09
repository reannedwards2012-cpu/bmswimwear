/**
 * POST /api/admin/bikini-mix/gallery/reorder     body: { order: string[] }
 *
 * Admin-only. Rewrites sort_order to match the given array of gallery image
 * ids (index 0 = first). Same shape as the existing product-images reorder
 * endpoint (PATCH /api/admin/products/:id/images). Ids that don't belong to
 * any existing row are ignored rather than rejected, so a stale client-side
 * list (e.g. a photo deleted in another tab) never blocks a reorder.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { isMigrationNotAppliedError } from '../../../../utils/bikiniMixMigrationGuard.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const order = Array.isArray(body?.order) ? body.order.filter((v) => typeof v === 'string' && UUID_RE.test(v)) : null

  if (!order || !order.length) {
    setResponseStatus(event, 400)
    return { error: 'Provide `order` as an array of gallery image ids.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: rows, error: readErr } = await supabase.from('bikini_mix_gallery_images').select('id')
    if (readErr) {
      if (isMigrationNotAppliedError(readErr)) {
        setResponseStatus(event, 503)
        return { configured: false, error: 'Swimsuit Mixer migration not applied yet.' }
      }
      console.error('[admin/bikini-mix/gallery] reorder read failed:', readErr.message)
      setResponseStatus(event, 500)
      return { error: 'Could not reorder images.' }
    }
    const owned = new Set((rows ?? []).map((r) => r.id))
    const valid = order.filter((id) => owned.has(id))

    for (let i = 0; i < valid.length; i++) {
      const { error } = await supabase.from('bikini_mix_gallery_images').update({ sort_order: i }).eq('id', valid[i])
      if (error) throw new Error(`reorder: ${error.message}`)
    }

    return { ok: true, reorderedCount: valid.length }
  } catch (err) {
    console.error('[admin/bikini-mix/gallery] unexpected reorder error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not reorder images.' }
  }
})
