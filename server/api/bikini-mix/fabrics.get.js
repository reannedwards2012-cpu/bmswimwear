/**
 * GET /api/bikini-mix/fabrics
 *
 * Public. The fabrics the admin has opted in to the Bikini Mix builder
 * (bikini_mix_fabrics.is_active = true), with the live fabric's own
 * is_active/status also required — mirrors the admin endpoint's
 * compatibility checklist, but only returns what a customer needs to
 * render swatches (no internal flags). Same real-data-only handling as
 * event.get.js — no mock fallback on the frontend, so 503 is reserved for
 * "migration not applied" and any other failure is a real 500.
 */
import { supabaseAdmin } from '../../utils/supabaseAdmin.js'
import { BIKINI_MIX_FABRIC_SELECT, mapBikiniMixFabric } from '../../utils/bikiniMixMappers.js'
import { isMigrationNotAppliedError } from '../../utils/bikiniMixMigrationGuard.js'

export default defineEventHandler(async (event) => {
  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('bikini_mix_fabrics')
      .select(BIKINI_MIX_FABRIC_SELECT)
      .eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false })

    if (error) {
      // Covers both "table missing" (migration never run at all) and
      // "column missing" (table exists from an earlier migration, but
      // eligible_for_onepiece — added later — doesn't yet) — both mean
      // "migration not applied", same as event.get.js.
      if (isMigrationNotAppliedError(error)) {
        setResponseStatus(event, 503)
        return { configured: false }
      }
      console.error('[bikini-mix/fabrics] query failed:', error.message)
      setResponseStatus(event, 500)
      return { configured: false, error: 'Could not load fabric options.' }
    }

    const fabrics = (data ?? [])
      .map(mapBikiniMixFabric)
      .filter((r) => r.fabric && r.fabric.isActive && r.fabric.status !== 'unavailable')
      .map((r) => ({
        id: r.fabric.id,
        name: r.fabric.name,
        hexColor: r.fabric.hexColor,
        imageUrl: r.fabric.imageUrl,
        eligibleForOnepiece: r.eligibleForOnepiece
      }))

    return { configured: true, fabrics }
  } catch (err) {
    console.error('[bikini-mix/fabrics] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { configured: false, error: 'Could not load fabric options.' }
  }
})
