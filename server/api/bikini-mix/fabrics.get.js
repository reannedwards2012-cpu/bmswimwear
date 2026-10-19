/**
 * GET /api/bikini-mix/fabrics
 *
 * Public. The fabrics the admin has opted in to the Bikini Mix builder
 * (bikini_mix_fabrics.is_active = true), with the live fabric's own
 * is_active/status also required — mirrors the admin endpoint's
 * compatibility checklist, but only returns what a customer needs to
 * render swatches (no internal flags). Same "migration not applied yet"
 * handling as event.get.js: a missing-table/schema-cache error is reported
 * as {configured:false}, not a 500.
 */
import { supabaseAdmin } from '../../utils/supabaseAdmin.js'
import { BIKINI_MIX_FABRIC_SELECT, mapBikiniMixFabric } from '../../utils/bikiniMixMappers.js'

export default defineEventHandler(async (event) => {
  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('bikini_mix_fabrics')
      .select(BIKINI_MIX_FABRIC_SELECT)
      .eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false })

    if (error) {
      // '42P01' = undefined_table, 'PGRST205' = PostgREST schema-cache miss
      // — both mean the migration hasn't been applied yet, same as event.get.js.
      const notConfigured = error.code === '42P01' || error.code === 'PGRST205'
      if (!notConfigured) console.error('[bikini-mix/fabrics] query failed:', error.message)
      setResponseStatus(event, 503)
      return { configured: false }
    }

    const fabrics = (data ?? [])
      .map(mapBikiniMixFabric)
      .filter((r) => r.fabric && r.fabric.isActive && r.fabric.status !== 'unavailable')
      .map((r) => ({
        id: r.fabric.id,
        name: r.fabric.name,
        hexColor: r.fabric.hexColor,
        imageUrl: r.fabric.imageUrl
      }))

    return { configured: true, fabrics }
  } catch (err) {
    console.error('[bikini-mix/fabrics] unexpected error:', err?.message)
    setResponseStatus(event, 503)
    return { configured: false }
  }
})
