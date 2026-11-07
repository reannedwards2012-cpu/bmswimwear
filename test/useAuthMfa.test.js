// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

/**
 * Phase 3 (MFA) — composables/useAuth.js's reactive MFA state
 * (needsMfaEnrollment / needsMfaStepUp / mfaSatisfied) and the TOTP action
 * wrappers (enrollTotp / verifyTotp / listTotpFactors / unenrollTotp).
 *
 * This is display/UX routing logic only — server/utils/authUser.js
 * (test/authUserMfa.test.js) is the real security boundary. The property
 * under test here is specifically that these three computeds classify every
 * combination of {isAdmin, currentLevel, nextLevel} correctly, since a
 * wrong classification would send an admin into the wrong screen (not a
 * security hole, since the server re-checks regardless, but still wrong).
 */

let mfaClient

function stubGlobals() {
  const registry = new Map()
  vi.stubGlobal('useState', (key, init) => {
    if (!registry.has(key)) registry.set(key, ref(init()))
    return registry.get(key)
  })
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { supabaseUrl: 'https://proj.supabase.co', supabaseKey: 'anon-key' } }))

  mfaClient = {
    enroll: vi.fn(),
    challengeAndVerify: vi.fn(),
    listFactors: vi.fn(),
    unenroll: vi.fn(),
    getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null }))
  }
  const fakeSupabaseClient = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      mfa: mfaClient
    }
  }
  vi.doMock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => fakeSupabaseClient) }))
}

let useAuth, initAuthClient

beforeEach(async () => {
  vi.resetModules()
  stubGlobals()
  ;({ useAuth, initAuthClient } = await import('../composables/useAuth.js'))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.doUnmock('@supabase/supabase-js')
})

async function setUser(overrides = {}) {
  const { user } = useAuth()
  user.value = { id: 'u1', email: 'a@example.com', app_metadata: {}, ...overrides }
}

describe('useAuth MFA computeds', () => {
  it('a non-admin never needs enrollment or step-up, regardless of aal level', async () => {
    await initAuthClient()
    await setUser({ app_metadata: { is_admin: false } })
    const { needsMfaEnrollment, needsMfaStepUp, mfaSatisfied } = useAuth()

    expect(needsMfaEnrollment.value).toBe(false)
    expect(needsMfaStepUp.value).toBe(false)
    expect(mfaSatisfied.value).toBe(true)
  })

  it('an admin with no verified factor at all (next=aal1) needs ENROLLMENT, not step-up', async () => {
    mfaClient.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null })
    await initAuthClient()
    await setUser({ app_metadata: { is_admin: true } })
    const { needsMfaEnrollment, needsMfaStepUp, mfaSatisfied } = useAuth()

    expect(needsMfaEnrollment.value).toBe(true)
    expect(needsMfaStepUp.value).toBe(false)
    expect(mfaSatisfied.value).toBe(false)
  })

  it('an admin who HAS a verified factor but this session is still aal1 needs STEP-UP, not enrollment', async () => {
    mfaClient.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null })
    await initAuthClient()
    await setUser({ app_metadata: { is_admin: true } })
    const { needsMfaEnrollment, needsMfaStepUp, mfaSatisfied } = useAuth()

    expect(needsMfaEnrollment.value).toBe(false)
    expect(needsMfaStepUp.value).toBe(true)
    expect(mfaSatisfied.value).toBe(false)
  })

  it('an admin fully at aal2 needs neither — satisfied', async () => {
    mfaClient.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null })
    await initAuthClient()
    await setUser({ app_metadata: { is_admin: true } })
    const { needsMfaEnrollment, needsMfaStepUp, mfaSatisfied } = useAuth()

    expect(needsMfaEnrollment.value).toBe(false)
    expect(needsMfaStepUp.value).toBe(false)
    expect(mfaSatisfied.value).toBe(true)
  })

  it('a failed/errored AAL lookup degrades to "not satisfied" for an admin, never silently passes', async () => {
    mfaClient.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: null, error: { message: 'network error' } })
    await initAuthClient()
    await setUser({ app_metadata: { is_admin: true } })
    const { mfaSatisfied } = useAuth()

    expect(mfaSatisfied.value).toBe(false)
  })
})

describe('signIn — fresh, awaited isAdmin/needsMfaStepUp immediately on resolve (not left to onAuthStateChange timing)', () => {
  it('a password sign-in for an admin with a verified factor leaves needsMfaStepUp true the instant signIn() resolves, with no extra wait', async () => {
    mfaClient.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null })
    await initAuthClient()
    const { signIn, isAdmin, needsMfaStepUp } = useAuth()

    // Reaching into the mocked client to make getUser() (called by signIn's
    // internal sync) resolve as this admin — getSession() alone (used only
    // at hydrate) deliberately stays signed-out so this is unambiguously
    // exercising signIn's own explicit sync, not the initial hydrate.
    const client = (await import('@supabase/supabase-js')).createClient()
    client.auth.getUser = vi.fn(async () => ({ data: { user: { id: 'admin-1', app_metadata: { is_admin: true } } } }))

    await signIn('admin@example.com', 'correct-password')
    expect(isAdmin.value).toBe(true)
    expect(needsMfaStepUp.value).toBe(true)
  })

  it('a failed sign-in never touches user/mfaLevel state', async () => {
    const client = (await import('@supabase/supabase-js')).createClient()
    client.auth.signInWithPassword = vi.fn(async () => ({ error: { message: 'Invalid login credentials' } }))
    await initAuthClient()
    const { signIn, isAdmin } = useAuth()

    const res = await signIn('a@example.com', 'wrong')
    expect(res).toEqual({ error: 'Invalid login credentials' })
    expect(isAdmin.value).toBe(false)
  })
})

describe('signOut — clears mfaLevel along with the user (no stale aal2 lingers after logout)', () => {
  it('resets mfaLevel to {null, null} on successful sign-out', async () => {
    mfaClient.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null })
    await initAuthClient()
    await setUser({ app_metadata: { is_admin: true } })
    const { signOut, mfaLevel } = useAuth()

    expect(mfaLevel.value.current).toBe('aal2')
    await signOut()
    expect(mfaLevel.value).toEqual({ current: null, next: null })
  })
})

describe('useAuth MFA action wrappers', () => {
  it('enrollTotp surfaces the QR/secret/uri/factorId from a successful enroll() call', async () => {
    mfaClient.enroll.mockResolvedValue({ data: { id: 'factor-1', totp: { qr_code: 'data:svg...', secret: 'ABC123', uri: 'otpauth://...' } }, error: null })
    await initAuthClient()
    const { enrollTotp } = useAuth()

    const res = await enrollTotp('My Phone')
    expect(res).toEqual({ error: null, factorId: 'factor-1', qrCode: 'data:svg...', secret: 'ABC123', uri: 'otpauth://...' })
    expect(mfaClient.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'My Phone' })
  })

  it('enrollTotp prepends the data: URI prefix when Supabase returns the raw SVG markup unprefixed (its own docs disagree on which it does) — the <img> must render either way', async () => {
    mfaClient.enroll.mockResolvedValue({ data: { id: 'factor-1', totp: { qr_code: '<svg>raw markup, no prefix</svg>', secret: 'ABC123', uri: 'otpauth://...' } }, error: null })
    await initAuthClient()
    const { enrollTotp } = useAuth()

    const res = await enrollTotp('My Phone')
    expect(res.qrCode).toBe('data:image/svg+xml;utf-8,<svg>raw markup, no prefix</svg>')
  })

  it('enrollTotp surfaces an error message on failure', async () => {
    mfaClient.enroll.mockResolvedValue({ data: null, error: { message: 'Too many factors' } })
    await initAuthClient()
    const { enrollTotp } = useAuth()

    const res = await enrollTotp()
    expect(res).toEqual({ error: 'Too many factors' })
  })

  it('verifyTotp calls challengeAndVerify with the code, and refreshes mfaLevel on success', async () => {
    mfaClient.challengeAndVerify.mockResolvedValue({ data: {}, error: null })
    mfaClient.getAuthenticatorAssuranceLevel
      .mockResolvedValueOnce({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null }) // initial hydrate
      .mockResolvedValueOnce({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null }) // post-verify refresh
    await initAuthClient()
    const { verifyTotp, mfaLevel } = useAuth()

    expect(mfaLevel.value.current).toBe('aal1')
    const res = await verifyTotp('factor-1', '123456')
    expect(res).toEqual({ error: null })
    expect(mfaClient.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'factor-1', code: '123456' })
    expect(mfaLevel.value.current).toBe('aal2')
  })

  it('verifyTotp surfaces "invalid/expired code" style errors without touching mfaLevel', async () => {
    mfaClient.challengeAndVerify.mockResolvedValue({ data: null, error: { message: 'Invalid TOTP code entered' } })
    mfaClient.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null })
    await initAuthClient()
    const { verifyTotp, mfaLevel } = useAuth()

    const res = await verifyTotp('factor-1', '000000')
    expect(res).toEqual({ error: 'Invalid TOTP code entered' })
    expect(mfaLevel.value.current).toBe('aal1') // unchanged — never silently advances on failure
  })

  it('listTotpFactors returns only the totp array', async () => {
    mfaClient.listFactors.mockResolvedValue({ data: { totp: [{ id: 'f1', status: 'verified' }], phone: [] }, error: null })
    await initAuthClient()
    const { listTotpFactors } = useAuth()

    const res = await listTotpFactors()
    expect(res).toEqual({ factors: [{ id: 'f1', status: 'verified' }], error: null })
  })

  it('unenrollTotp refreshes mfaLevel after removing a factor', async () => {
    mfaClient.unenroll.mockResolvedValue({ data: { id: 'f1' }, error: null })
    mfaClient.getAuthenticatorAssuranceLevel
      .mockResolvedValueOnce({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null })
      .mockResolvedValueOnce({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null })
    await initAuthClient()
    const { unenrollTotp, mfaLevel } = useAuth()

    expect(mfaLevel.value.current).toBe('aal2')
    await unenrollTotp('f1')
    expect(mfaClient.unenroll).toHaveBeenCalledWith({ factorId: 'f1' })
    expect(mfaLevel.value.current).toBe('aal1')
  })
})
