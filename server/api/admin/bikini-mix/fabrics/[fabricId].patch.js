/**
 * PATCH /api/admin/bikini-mix/fabrics/:fabricId
 *
 * Admin-only. Toggles whether one existing fabric is offered in the Bikini
 * Mix builder — upserts the bikini_mix_fabrics join row. Never touches the
 * `fabrics` table itself.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const fabricId = getRouterParam(event, 'fabricId')
  if (!fabricId || !UUID_RE.test(fabricId)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid fabric id.' }
  }

  const body = await readBody(event).catch(() => null)
  if (typeof body?.isActive !== 'boolean') {
    setResponseStatus(event, 400)
    return { error: 'isActive must be true or false.' }
  }

  try {
    const supabase = supabaseAdmin()

    const { data: fabric, error: fabricError } = await supabase
      .from('fabrics')
      .select('id')
      .eq('id', fabricId)
      .maybeSingle()
    if (fabricError) {
      console.error('[admin/bikini-mix/fabrics] lookup failed:', fabricError.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update fabric.' }
    }
    if (!fabric) {
      setResponseStatus(event, 404)
      return { error: 'Fabric not found.' }
    }

    const { error } = await supabase
      .from('bikini_mix_fabrics')
      .upsert({ fabric_id: fabricId, is_active: body.isActive }, { onConflict: 'fabric_id' })

    if (error) {
      console.error('[admin/bikini-mix/fabrics] upsert failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update fabric.' }
    }

    return { fabricId, isActive: body.isActive }
  } catch (err) {
    console.error('[admin/bikini-mix/fabrics] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update fabric.' }
  }
})
