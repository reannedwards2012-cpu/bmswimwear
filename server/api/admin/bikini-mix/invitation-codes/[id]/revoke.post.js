/**
 * POST /api/admin/bikini-mix/invitation-codes/:id/revoke
 *
 * Admin-only. Revokes an ACTIVE code only — never un-revokes, and never
 * touches an already-redeemed code (its booking is real and stays real;
 * revoking would have no meaning there). Frees that category's issuance
 * cap for a new code.
 */
import { supabaseAdmin } from '../../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../../utils/authUser.js'
import { mapInvitationCode, INVITATION_CODE_SELECT } from '../../../../../utils/bikiniMixMappers.js'
import { isMigrationNotAppliedError } from '../../../../../utils/bikiniMixMigrationGuard.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid invitation code id.' }
  }

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('bikini_mix_invitation_codes')
      .update({ status: 'revoked' })
      .eq('id', id)
      .eq('status', 'active')
      .select(INVITATION_CODE_SELECT)
      .maybeSingle()

    if (error) {
      if (isMigrationNotAppliedError(error)) {
        setResponseStatus(event, 503)
        return { configured: false, error: 'Swimsuit Mixer migration not applied yet.' }
      }
      console.error('[admin/bikini-mix/invitation-codes] revoke failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not revoke invitation code.' }
    }
    if (!data) {
      setResponseStatus(event, 404)
      return { error: 'That code is not active (already redeemed, revoked, or does not exist).' }
    }

    return { code: mapInvitationCode(data) }
  } catch (err) {
    console.error('[admin/bikini-mix/invitation-codes] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not revoke invitation code.' }
  }
})
