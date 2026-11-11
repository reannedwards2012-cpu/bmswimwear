/**
 * GET /api/admin/bikini-mix/invitation-codes
 *
 * Admin-only. Every invitation code — never the plaintext (it was never
 * stored; see server/utils/bikiniMixInvitationCodes.js).
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { INVITATION_CODE_SELECT, mapInvitationCode } from '../../../../utils/bikiniMixMappers.js'
import { isMigrationNotAppliedError } from '../../../../utils/bikiniMixMigrationGuard.js'

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('bikini_mix_invitation_codes')
      .select(INVITATION_CODE_SELECT)
      .order('created_at', { ascending: false })

    if (error) {
      if (isMigrationNotAppliedError(error)) {
        setResponseStatus(event, 503)
        return { configured: false, error: 'Swimsuit Mixer migration not applied yet.' }
      }
      console.error('[admin/bikini-mix/invitation-codes] list failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load invitation codes.' }
    }

    const codes = (data ?? []).map(mapInvitationCode)
    const counts = { event_assistant: { active: 0, redeemed: 0 }, giveaway: { active: 0, redeemed: 0 }, other: { active: 0, redeemed: 0 } }
    for (const c of codes) {
      if (counts[c.category] && (c.status === 'active' || c.status === 'redeemed')) counts[c.category][c.status] += 1
    }

    return { codes, counts }
  } catch (err) {
    console.error('[admin/bikini-mix/invitation-codes] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load invitation codes.' }
  }
})
