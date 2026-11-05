/**
 * PATCH /api/admin/bikini-mix/fabrics/:fabricId
 *
 * Admin-only. Toggles whether one existing fabric is offered in the
 * Swimsuit Mixer builder, and/or whether it's eligible for one-pieces
 * specifically — upserts the bikini_mix_fabrics join row. Never touches
 * the `fabrics` table itself. Either flag (or both) may be sent; at least
 * one must be present.
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { validateFabricEligibilityFields } from '../../../../utils/bikiniMixValidation.js'
import { isMigrationNotAppliedError } from '../../../../utils/bikiniMixMigrationGuard.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const fabricId = getRouterParam(event, 'fabricId')
  if (!fabricId || !UUID_RE.test(fabricId)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid fabric id.' }
  }

  const body = await readBody(event).catch(() => null)
  const { issues, fields } = validateFabricEligibilityFields(body, { partial: true })
  if (issues.length) {
    setResponseStatus(event, 400)
    return { error: 'Invalid eligibility details.', issues }
  }
  if (!Object.keys(fields).length) {
    setResponseStatus(event, 400)
    return { error: 'isActive and/or eligibleForOnepiece must be provided.' }
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

    const upsertPayload = { fabric_id: fabricId }
    if (Object.prototype.hasOwnProperty.call(fields, 'isActive')) upsertPayload.is_active = fields.isActive
    if (Object.prototype.hasOwnProperty.call(fields, 'eligibleForOnepiece')) upsertPayload.eligible_for_onepiece = fields.eligibleForOnepiece

    const { data, error } = await supabase
      .from('bikini_mix_fabrics')
      .upsert(upsertPayload, { onConflict: 'fabric_id' })
      .select('is_active, eligible_for_onepiece')
      .maybeSingle()

    if (error) {
      if (isMigrationNotAppliedError(error)) {
        setResponseStatus(event, 503)
        return { configured: false, error: 'Swimsuit Mixer migration not applied yet — changes cannot be saved.' }
      }
      console.error('[admin/bikini-mix/fabrics] upsert failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not update fabric.' }
    }

    return { fabricId, isActive: data?.is_active ?? fields.isActive, eligibleForOnepiece: data?.eligible_for_onepiece ?? fields.eligibleForOnepiece ?? false }
  } catch (err) {
    console.error('[admin/bikini-mix/fabrics] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not update fabric.' }
  }
})
