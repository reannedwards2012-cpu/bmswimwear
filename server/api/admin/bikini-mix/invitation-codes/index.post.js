/**
 * POST /api/admin/bikini-mix/invitation-codes    body: { category, notes? }
 *
 * Admin-only. Generates a fresh complimentary invitation code, enforces
 * that category's issuance cap (bikini_mix_event.comp_<category>_slots),
 * and stores ONLY the code's hash. The plaintext is returned here, in this
 * response, EXACTLY ONCE — there is no other endpoint or admin view that
 * can ever retrieve it again. If it's lost, revoke this code and generate
 * a new one.
 *
 * The cap check here is a plain count (no row lock) — admin-only, low
 * volume, a soft business control against accidentally over-issuing codes,
 * not a concurrency-sensitive guarantee like redemption itself (that one
 * IS lock-protected, inside claim_bikini_mix_comp_booking()).
 */
import { supabaseAdmin } from '../../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../../utils/authUser.js'
import { validateInvitationCodeGeneration } from '../../../../utils/bikiniMixValidation.js'
import { generateInvitationCode, codeHash, CATEGORY_LABELS } from '../../../../utils/bikiniMixInvitationCodes.js'
import { isMigrationNotAppliedError } from '../../../../utils/bikiniMixMigrationGuard.js'

const SLOTS_COLUMN_BY_CATEGORY = {
  event_assistant: 'comp_event_assistant_slots',
  giveaway: 'comp_giveaway_slots',
  other: 'comp_other_slots'
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const body = await readBody(event).catch(() => null)
  const { issues, fields } = validateInvitationCodeGeneration(body)
  if (issues.length) {
    setResponseStatus(event, 400)
    return { error: 'Invalid invitation code details.', issues }
  }

  try {
    const supabase = supabaseAdmin()
    const slotsColumn = SLOTS_COLUMN_BY_CATEGORY[fields.category]

    const [{ data: eventRow, error: eventErr }, { count: issuedCount, error: countErr }] = await Promise.all([
      supabase.from('bikini_mix_event').select(slotsColumn).eq('id', 'default').maybeSingle(),
      supabase
        .from('bikini_mix_invitation_codes')
        .select('id', { count: 'exact', head: true })
        .eq('category', fields.category)
        .in('status', ['active', 'redeemed'])
    ])

    if (eventErr || countErr) {
      const err = eventErr || countErr
      if (isMigrationNotAppliedError(err)) {
        setResponseStatus(event, 503)
        return { configured: false, error: 'Swimsuit Mixer migration not applied yet.' }
      }
      console.error('[admin/bikini-mix/invitation-codes] cap check failed:', err.message)
      setResponseStatus(event, 500)
      return { error: 'Could not generate invitation code.' }
    }

    const cap = eventRow?.[slotsColumn] ?? 0
    if ((issuedCount ?? 0) >= cap) {
      setResponseStatus(event, 409)
      return { error: `The ${CATEGORY_LABELS[fields.category]} cap (${cap}) has already been reached. Revoke an unused code or raise the cap in Event Settings first.` }
    }

    // Collision odds against a ~2^60 keyspace are negligible, but retry a
    // handful of times on the (unique-constraint) off-chance rather than
    // ever surface that as a user-facing error.
    let code, hash, row, insertError
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateInvitationCode()
      hash = codeHash(code)
      if (!hash) {
        console.error('[admin/bikini-mix/invitation-codes] codeHash() returned null — INQUIRY_HASH_SECRET missing?')
        setResponseStatus(event, 500)
        return { error: 'Could not generate invitation code.' }
      }
      const res = await supabase
        .from('bikini_mix_invitation_codes')
        .insert({ code_hash: hash, category: fields.category, notes: fields.notes })
        .select('id, category, status, notes, created_at')
        .single()
      row = res.data
      insertError = res.error
      if (!insertError) break
      if (insertError.code !== '23505') break // not a unique-violation — don't retry a real error
    }

    if (insertError || !row) {
      if (isMigrationNotAppliedError(insertError)) {
        setResponseStatus(event, 503)
        return { configured: false, error: 'Swimsuit Mixer migration not applied yet.' }
      }
      console.error('[admin/bikini-mix/invitation-codes] insert failed:', insertError?.message)
      setResponseStatus(event, 500)
      return { error: 'Could not generate invitation code.' }
    }

    setResponseStatus(event, 201)
    return {
      code, // the ONLY time this plaintext is ever returned
      id: row.id,
      category: row.category,
      categoryLabel: CATEGORY_LABELS[row.category] || row.category,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at
    }
  } catch (err) {
    console.error('[admin/bikini-mix/invitation-codes] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not generate invitation code.' }
  }
})
