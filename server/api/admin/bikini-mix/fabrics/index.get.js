/**
 * GET /api/admin/bikini-mix/fabrics
 *
 * Admin-only. Every active site fabric, with whether it's currently
 * enabled for the Bikini Mix builder. A fabric with no bikini_mix_fabrics
 * row yet is reported as isActive:false (not yet opted in) — mirrors the
 * product_fabrics compatibility-checklist pattern used elsewhere.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  try {
    const supabase = supabaseAdmin()

    const [{ data: fabricRows, error: fabricError }, { data: linkRows, error: linkError }] = await Promise.all([
      supabase
        .from('fabrics')
        .select('id, name, slug, type, hex_color, image_url, status, is_active')
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabase.from('bikini_mix_fabrics').select('fabric_id, is_active, sort_order')
    ])

    if (fabricError || linkError) {
      console.error('[admin/bikini-mix/fabrics] query failed:', fabricError?.message || linkError?.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load fabrics.' }
    }

    const linkByFabric = new Map((linkRows ?? []).map((r) => [r.fabric_id, r]))

    const fabrics = (fabricRows ?? []).map((f) => {
      const link = linkByFabric.get(f.id)
      return {
        fabricId: f.id,
        name: f.name,
        slug: f.slug,
        type: f.type,
        hexColor: f.hex_color,
        imageUrl: f.image_url,
        status: f.status,
        bikiniMixActive: link?.is_active ?? false
      }
    })

    return { fabrics }
  } catch (err) {
    console.error('[admin/bikini-mix/fabrics] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load fabrics.' }
  }
})
