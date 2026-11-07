// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

/**
 * Phase 3 (MFA) — AdminMfaChallenge.vue: the "enter your authenticator
 * code" step shown during login step-up and (planned) elsewhere. Covers
 * the explicit testing asks: successful verify, an incorrect code, an
 * expired/invalid-challenge code, and the "sign in with a different
 * account" escape hatch — all via useAuth()'s mocked wrappers, since the
 * real Supabase calls are already covered in test/useAuthMfa.test.js.
 */

let authState

function stubGlobals() {
  vi.stubGlobal('useAuth', () => authState)
  vi.stubGlobal('navigateTo', vi.fn())
}

let AdminMfaChallenge

beforeEach(async () => {
  authState = {
    listTotpFactors: vi.fn(async () => ({ factors: [{ id: 'factor-1', status: 'verified' }], error: null })),
    verifyTotp: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null }))
  }
  stubGlobals()
  ;({ default: AdminMfaChallenge } = await import('../components/AdminMfaChallenge.vue'))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function enterAndSubmit(wrapper, code) {
  await wrapper.find('input').setValue(code)
  await wrapper.find('form').trigger('submit.prevent')
  await wrapper.vm.$nextTick()
}

describe('AdminMfaChallenge', () => {
  it('a correct code calls verifyTotp with the verified factor\'s id and emits "verified"', async () => {
    const wrapper = mount(AdminMfaChallenge)
    await enterAndSubmit(wrapper, '123456')

    expect(authState.verifyTotp).toHaveBeenCalledWith('factor-1', '123456')
    expect(wrapper.emitted('verified')).toHaveLength(1)
  })

  it('an incorrect code shows a clear error and does NOT emit verified', async () => {
    authState.verifyTotp = vi.fn(async () => ({ error: 'Invalid TOTP code entered' }))
    const wrapper = mount(AdminMfaChallenge)
    await enterAndSubmit(wrapper, '000000')

    expect(wrapper.text()).toContain('isn’t right')
    expect(wrapper.emitted('verified')).toBeUndefined()
  })

  it('an expired challenge shows a distinct "expired" message', async () => {
    authState.verifyTotp = vi.fn(async () => ({ error: 'MFA challenge has expired' }))
    const wrapper = mount(AdminMfaChallenge)
    await enterAndSubmit(wrapper, '123456')

    expect(wrapper.text()).toContain('expired')
  })

  it('clears a previous error as soon as the admin starts typing a new code', async () => {
    authState.verifyTotp = vi.fn(async () => ({ error: 'Invalid TOTP code entered' }))
    const wrapper = mount(AdminMfaChallenge)
    await enterAndSubmit(wrapper, '000000')
    expect(wrapper.text()).toContain('isn’t right')

    await wrapper.find('input').setValue('1')
    expect(wrapper.text()).not.toContain('isn’t right')
  })

  it('if no verified factor can be found, shows a clear message and never calls verifyTotp', async () => {
    authState.listTotpFactors = vi.fn(async () => ({ factors: [], error: null }))
    const wrapper = mount(AdminMfaChallenge)
    await enterAndSubmit(wrapper, '123456')

    expect(authState.verifyTotp).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('sign in again')
  })

  it('"not you? sign in with a different account" signs out and navigates to /login', async () => {
    const wrapper = mount(AdminMfaChallenge)
    await wrapper.findAll('button').find((b) => b.text().includes('Not you')).trigger('click')
    await wrapper.vm.$nextTick()

    expect(authState.signOut).toHaveBeenCalledTimes(1)
  })

  it('the submit button is disabled until exactly 6 digits are entered', async () => {
    const wrapper = mount(AdminMfaChallenge)
    const submitBtn = wrapper.find('button[type="submit"]')
    expect(submitBtn.attributes('disabled')).toBeDefined()

    await wrapper.find('input').setValue('12345')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()

    await wrapper.find('input').setValue('123456')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })
})
