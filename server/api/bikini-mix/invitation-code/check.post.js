/**
 * POST /api/bikini-mix/invitation-code/check    body: { code }
 *
 * Public, read-only. Lets a guest find out BEFORE submitting the full
 * booking form whether a code they typed is currently valid, and which
 * category it's for — purely a UX nicety. Returns ONLY `{ valid, category }`
 * (or `{ valid: false }`) — never the code itself, never any other code,
 * never redeemed/revoked timestamps or who redeemed it.
 *
 * This endpoint NEVER redeems anything — redemption only ever happens
 * atomically inside claim_bikini_mix_comp_booking(), at final submission
 * (server/api/bikini-mix/checkout-comp.post.js). Calling this as many
 * times as you like with a valid, still-active code always returns the
 * same answer and changes nothing.
 *
 * This is also the endpoint an attacker would hammer to guess a code, so
 * it gets the tightest rate limit in this feature (tighter than real
 * checkout) on top of the code's own ~2^60 keyspace — see
 * server/utils/bikiniMixInvitationCodes.js.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { validateInvitationCodeInput } from '../../../utils/bikiniMixValidation.js'
import { codeHash, CATEGORY_LABELS } from '../../../utils/bikiniMixInvitationCodes.js'
import { resolveClientIp, ipHash } from '../../../utils/inquiryRateLimit.js'
import { checkRateLimit, recordRateHit } from '../../../utils/checkoutRateLimit.js'
import { isMigrationNotAppliedError } from '../../../utils/bikiniMixMigrationGuard.js'

const RATE_SCOPE = 'bikini-mix-invite-check'
const RATE_WINDOW_MINUTES = 10
const RATE_MAX_PER_WINDOW = 5

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null)
  const { issues, code } = validateInvitationCodeInput(body)
  if (issues.length) {
    setResponseStatus(event, 400)
    return { valid: false, error: issues[0] }
  }

  try {
    const supabase = supabaseAdmin()

    const clientIp = resolveClientIp(event)
    const ipHashValue = ipHash(clientIp)
    const gate = await checkRateLimit(supabase, {
      scope: RATE_SCOPE,
      keyHash: ipHashValue,
      windowMinutes: RATE_WINDOW_MINUTES,
      maxPerWindow: RATE_MAX_PER_WINDOW
    })
    if (!gate.ok) {
      setResponseStatus(event, 429)
      setResponseHeader(event, 'Retry-After', String(gate.retryAfterSeconds))
      return { valid: false, error: 'Too many attempts — please wait a few minutes and try again.' }
    }
    await recordRateHit(supabase, { scope: RATE_SCOPE, keyHash: ipHashValue })

    const hash = codeHash(code)
    if (!hash) {
      // INQUIRY_HASH_SECRET missing — fails CLOSED for codes (see
      // codeHash()'s comment): never treat "we couldn't hash it" as valid.
      console.error('[bikini-mix invitation-code check] codeHash() returned null — INQUIRY_HASH_SECRET missing?')
      return { valid: false }
    }

    const { data, error } = await supabase
      .from('bikini_mix_invitation_codes')
      .select('category, status')
      .eq('code_hash', hash)
      .maybeSingle()

    if (error) {
      if (isMigrationNotAppliedError(error)) {
        setResponseStatus(event, 503)
        return { configured: false, valid: false }
      }
      console.error('[bikini-mix invitation-code check] lookup failed:', error.message)
      return { valid: false }
    }

    if (!data || data.status !== 'active') {
      return { valid: false }
    }

    return { valid: true, category: data.category, categoryLabel: CATEGORY_LABELS[data.category] || data.category }
  } catch (err) {
    console.error('[bikini-mix invitation-code check] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { valid: false }
  }
})
