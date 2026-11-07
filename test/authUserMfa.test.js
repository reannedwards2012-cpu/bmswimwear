import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Phase 3 (MFA) — requireAdmin() now also requires the presented token's
 * own `aal` claim to be 'aal2'. This is the real security boundary (every
 * admin API route calls this, independent of any client-side UI), so it's
 * tested directly and thoroughly: a valid admin session at aal1 — whether
 * never-enrolled, mid-step-up, or an old pre-MFA token still in use — must
 * never pass, under any combination of inputs.
 */

vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'

function stubGlobals() {
  vi.stubGlobal('getRequestHeader', (e, k) => (k === 'authorization' ? e._authHeader : undefined))
  vi.stubGlobal('createError', (opts) => Object.assign(new Error(opts.statusMessage), opts))
}
const event = (authHeader) => ({ _authHeader: authHeader })

function fakeSupabase({ user, userError, claims, claimsError } = {}) {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: user ? { user } : null, error: userError ?? (user ? null : { message: 'invalid' }) })),
      getClaims: vi.fn(async () => ({ data: claims ? { claims } : null, error: claimsError ?? (claims ? null : { message: 'invalid' }) }))
    }
  }
}

const ADMIN_USER = (overrides = {}) => ({
  id: 'admin-1', email: 'admin@example.com', email_confirmed_at: '2026-01-01',
  app_metadata: { is_admin: true }, factors: [], ...overrides
})

let requireAdmin, requireUser, getOptionalUserId

beforeEach(async () => {
  stubGlobals()
  ;({ requireAdmin, requireUser, getOptionalUserId } = await import('../server/utils/authUser.js'))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('requireAdmin — MFA (aal2) enforcement', () => {
  it('allows an admin whose token is aal2', async () => {
    const supabase = fakeSupabase({ user: ADMIN_USER({ factors: [{ status: 'verified' }] }), claims: { aal: 'aal2' } })
    supabaseAdmin.mockReturnValue(supabase)

    const result = await requireAdmin(event('Bearer good-token'))
    expect(result).toEqual({ id: 'admin-1', email: 'admin@example.com' })
  })

  it('rejects an admin at aal1 who has NEVER enrolled MFA — code: mfa_enrollment_required', async () => {
    const supabase = fakeSupabase({ user: ADMIN_USER({ factors: [] }), claims: { aal: 'aal1' } })
    supabaseAdmin.mockReturnValue(supabase)

    await expect(requireAdmin(event('Bearer good-token'))).rejects.toMatchObject({
      statusCode: 403,
      data: { code: 'mfa_enrollment_required' }
    })
  })

  it('rejects an admin at aal1 who HAS a verified factor but this token never stepped up — code: mfa_verification_required', async () => {
    const supabase = fakeSupabase({ user: ADMIN_USER({ factors: [{ status: 'verified' }] }), claims: { aal: 'aal1' } })
    supabaseAdmin.mockReturnValue(supabase)

    await expect(requireAdmin(event('Bearer good-token'))).rejects.toMatchObject({
      statusCode: 403,
      data: { code: 'mfa_verification_required' }
    })
  })

  it('recovery scenario (default/strict mode): after a lost factor is deleted via the admin API, the account is in the exact "never enrolled" state and gets mfa_enrollment_required — password alone is NEVER sufficient, there is no bypass window', async () => {
    // deleteFactor() leaves the account with zero factors — indistinguishable,
    // from requireAdmin's point of view, from an admin who never enrolled.
    const supabase = fakeSupabase({ user: ADMIN_USER({ factors: [] }), claims: { aal: 'aal1' } })
    supabaseAdmin.mockReturnValue(supabase)

    await expect(requireAdmin(event('Bearer good-token'))).rejects.toMatchObject({
      statusCode: 403,
      data: { code: 'mfa_enrollment_required' }
    })
  })

  it('rejects an UNVERIFIED-only factor the same as no factor at all (unverified never counts)', async () => {
    const supabase = fakeSupabase({ user: ADMIN_USER({ factors: [{ status: 'unverified' }] }), claims: { aal: 'aal1' } })
    supabaseAdmin.mockReturnValue(supabase)

    await expect(requireAdmin(event('Bearer good-token'))).rejects.toMatchObject({
      statusCode: 403,
      data: { code: 'mfa_enrollment_required' }
    })
  })

  it('a valid admin password/session alone (no MFA claim readable at all) is rejected, not defaulted to allow', async () => {
    const supabase = fakeSupabase({ user: ADMIN_USER(), claims: null, claimsError: { message: 'getClaims failed' } })
    supabaseAdmin.mockReturnValue(supabase)

    await expect(requireAdmin(event('Bearer good-token'))).rejects.toMatchObject({ statusCode: 403 })
  })

  it('an unrecognized aal value (e.g. a future/custom level) is never treated as satisfying aal2', async () => {
    const supabase = fakeSupabase({ user: ADMIN_USER({ factors: [{ status: 'verified' }] }), claims: { aal: 'something-else' } })
    supabaseAdmin.mockReturnValue(supabase)

    await expect(requireAdmin(event('Bearer good-token'))).rejects.toMatchObject({ statusCode: 403 })
  })

  it('still 401s a non-admin / signed-out request before ever checking aal (getClaims never called)', async () => {
    const supabase = fakeSupabase({ user: null })
    supabaseAdmin.mockReturnValue(supabase)

    await expect(requireAdmin(event(null))).rejects.toMatchObject({ statusCode: 401 })
    expect(supabase.auth.getClaims).not.toHaveBeenCalled()
  })

  it('still 403s a non-admin user before ever checking aal (getClaims never called)', async () => {
    const supabase = fakeSupabase({ user: ADMIN_USER({ app_metadata: { is_admin: false } }), claims: { aal: 'aal2' } })
    supabaseAdmin.mockReturnValue(supabase)

    await expect(requireAdmin(event('Bearer good-token'))).rejects.toMatchObject({ statusCode: 403 })
    expect(supabase.auth.getClaims).not.toHaveBeenCalled()
  })

  it('an expired/invalid/tampered token is 401, never reaches the aal check', async () => {
    const supabase = fakeSupabase({ user: null, userError: { message: 'invalid JWT' } })
    supabaseAdmin.mockReturnValue(supabase)

    await expect(requireAdmin(event('Bearer tampered-token'))).rejects.toMatchObject({ statusCode: 401 })
    expect(supabase.auth.getClaims).not.toHaveBeenCalled()
  })
})

describe('requireAdmin — ADMIN_MFA_ENFORCEMENT=grace (temporary rollout aid)', () => {
  const ORIGINAL_ENV = process.env.ADMIN_MFA_ENFORCEMENT

  async function loadInGraceMode() {
    process.env.ADMIN_MFA_ENFORCEMENT = 'grace'
    vi.resetModules()
    stubGlobals()
    return import('../server/utils/authUser.js')
  }

  afterEach(() => {
    process.env.ADMIN_MFA_ENFORCEMENT = ORIGINAL_ENV
    vi.resetModules()
  })

  it('allows a NEVER-enrolled admin through (no verified factor at all) — the exact pre-MFA posture, not a new weaker state', async () => {
    const { requireAdmin: graceRequireAdmin } = await loadInGraceMode()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const supabase = fakeSupabase({ user: ADMIN_USER({ factors: [] }), claims: { aal: 'aal1' } })
    supabaseAdmin.mockReturnValue(supabase)

    const result = await graceRequireAdmin(event('Bearer good-token'))
    expect(result).toEqual({ id: 'admin-1', email: 'admin@example.com' })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ADMIN_MFA_ENFORCEMENT=grace'))
  })

  it('still REJECTS an admin who already has a verified factor but this session has not stepped up — grace never loosens this, even during rollout', async () => {
    const { requireAdmin: graceRequireAdmin } = await loadInGraceMode()
    const supabase = fakeSupabase({ user: ADMIN_USER({ factors: [{ status: 'verified' }] }), claims: { aal: 'aal1' } })
    supabaseAdmin.mockReturnValue(supabase)

    await expect(graceRequireAdmin(event('Bearer good-token'))).rejects.toMatchObject({
      statusCode: 403,
      data: { code: 'mfa_verification_required' }
    })
  })

  it('recovery scenario: after a lost factor is deleted (admin now has zero factors again), grace mode would let them through — this is exactly why the recovery procedure must NEVER re-enable grace mode to "fix" a locked-out admin; strict mode already routes them to real re-enrollment on its own', async () => {
    const { requireAdmin: graceRequireAdmin } = await loadInGraceMode()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Admin whose factor was just deleted via the recovery procedure — same
    // shape as "never enrolled", by design (see authUser.js comment).
    const supabase = fakeSupabase({ user: ADMIN_USER({ factors: [] }), claims: { aal: 'aal1' } })
    supabaseAdmin.mockReturnValue(supabase)

    const result = await graceRequireAdmin(event('Bearer good-token'))
    expect(result).toEqual({ id: 'admin-1', email: 'admin@example.com' })
    // Demonstrating the risk directly: this is why grace must stay OFF
    // after initial rollout, and the rollout report says so explicitly.
  })

  it('still 401/403s a non-admin or signed-out request exactly as in strict mode — grace never touches that path', async () => {
    const { requireAdmin: graceRequireAdmin } = await loadInGraceMode()
    const supabase = fakeSupabase({ user: null })
    supabaseAdmin.mockReturnValue(supabase)

    await expect(graceRequireAdmin(event(null))).rejects.toMatchObject({ statusCode: 401 })
  })

  it('an unset ADMIN_MFA_ENFORCEMENT env var defaults to "required" (fail-secure) — grace is opt-in only', async () => {
    delete process.env.ADMIN_MFA_ENFORCEMENT
    vi.resetModules()
    stubGlobals()
    const { requireAdmin: defaultRequireAdmin } = await import('../server/utils/authUser.js')
    const supabase = fakeSupabase({ user: ADMIN_USER({ factors: [] }), claims: { aal: 'aal1' } })
    supabaseAdmin.mockReturnValue(supabase)

    await expect(defaultRequireAdmin(event('Bearer good-token'))).rejects.toMatchObject({
      statusCode: 403,
      data: { code: 'mfa_enrollment_required' }
    })
  })

  it('an unrecognized value (typo, e.g. "Grace" or "on") is NOT treated as grace mode — only the exact string "grace" opts in', async () => {
    process.env.ADMIN_MFA_ENFORCEMENT = 'Grace'
    vi.resetModules()
    stubGlobals()
    const { requireAdmin: typoRequireAdmin } = await import('../server/utils/authUser.js')
    const supabase = fakeSupabase({ user: ADMIN_USER({ factors: [] }), claims: { aal: 'aal1' } })
    supabaseAdmin.mockReturnValue(supabase)

    await expect(typoRequireAdmin(event('Bearer good-token'))).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('requireUser / getOptionalUserId — unaffected by the MFA check (customers never need it)', () => {
  it('requireUser succeeds for an ordinary customer at aal1, with no MFA factor, no getClaims call at all', async () => {
    const supabase = fakeSupabase({ user: { id: 'cust-1', email: 'jane@example.com', email_confirmed_at: '2026-01-01', app_metadata: {}, factors: [] } })
    supabaseAdmin.mockReturnValue(supabase)

    const result = await requireUser(event('Bearer good-token'))
    expect(result).toEqual({ id: 'cust-1', email: 'jane@example.com', emailVerified: true })
    expect(supabase.auth.getClaims).not.toHaveBeenCalled()
  })

  it('getOptionalUserId never calls getClaims either', async () => {
    const supabase = fakeSupabase({ user: { id: 'cust-1', email: 'jane@example.com', app_metadata: {}, factors: [] } })
    supabaseAdmin.mockReturnValue(supabase)

    const id = await getOptionalUserId(event('Bearer good-token'))
    expect(id).toBe('cust-1')
    expect(supabase.auth.getClaims).not.toHaveBeenCalled()
  })
})
