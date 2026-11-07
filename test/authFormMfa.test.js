// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

/**
 * Phase 3 (MFA) — AuthForm.vue's login-time step-up integration.
 * AdminMfaChallenge.vue itself (code entry, verify, errors) is stubbed and
 * tested separately in test/adminMfaChallenge.test.js — this file is only
 * about AuthForm's OWN decision of when to show it vs. complete sign-in
 * immediately, which is the piece that must never show a customer an MFA
 * prompt and must never let an admin skip a pending step-up.
 */

let authState

function stubGlobals() {
  vi.stubGlobal('useRoute', () => ({ query: {} }))
  vi.stubGlobal('useAuth', () => authState)
}

let AuthForm

beforeEach(async () => {
  authState = {
    signIn: vi.fn(async () => ({ error: null })),
    signUp: vi.fn(),
    resendConfirmation: vi.fn(),
    isLoggedIn: ref(false),
    needsMfaStepUp: ref(false)
  }
  stubGlobals()
  ;({ default: AuthForm } = await import('../components/AuthForm.vue'))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const STUBS = { AdminMfaChallenge: { name: 'AdminMfaChallenge', template: '<div data-testid="mfa-challenge-stub" />' } }

async function fillAndSubmit(wrapper, email = 'person@example.com', password = 'password123') {
  await wrapper.find('input[type="email"]').setValue(email)
  await wrapper.find('input[type="password"]').setValue(password)
  await wrapper.find('form').trigger('submit.prevent')
  await wrapper.vm.$nextTick()
}

describe('AuthForm — customer sign-in (no MFA anywhere in the picture)', () => {
  it('a normal customer sign-in completes immediately — no MFA prompt ever shown', async () => {
    const emitted = []
    const wrapper = mount(AuthForm, { props: { mode: 'signin' }, global: { stubs: STUBS }, attrs: { onAuthenticated: () => emitted.push(true) } })

    await fillAndSubmit(wrapper)

    expect(wrapper.find('[data-testid="mfa-challenge-stub"]').exists()).toBe(false)
    expect(emitted).toEqual([true])
  })
})

describe('AuthForm — admin sign-in step-up', () => {
  it('an admin with a verified factor sees the MFA challenge instead of completing sign-in', async () => {
    authState.needsMfaStepUp = ref(true) // signIn()'s internal sync would have set this fresh — simulated here
    const emitted = []
    const wrapper = mount(AuthForm, { props: { mode: 'signin' }, global: { stubs: STUBS }, attrs: { onAuthenticated: () => emitted.push(true) } })

    await fillAndSubmit(wrapper, 'admin@example.com', 'correct-password')

    expect(wrapper.find('[data-testid="mfa-challenge-stub"]').exists()).toBe(true)
    expect(emitted).toEqual([]) // never completed sign-in on password alone
  })

  it('completes sign-in once AdminMfaChallenge emits verified', async () => {
    authState.needsMfaStepUp = ref(true)
    const emitted = []
    const wrapper = mount(AuthForm, { props: { mode: 'signin' }, global: { stubs: STUBS }, attrs: { onAuthenticated: () => emitted.push(true) } })
    await fillAndSubmit(wrapper, 'admin@example.com', 'correct-password')

    await wrapper.findComponent({ name: 'AdminMfaChallenge' }).vm.$emit('verified')

    expect(emitted).toEqual([true])
  })

  it('an admin who has NEVER enrolled MFA (needsMfaStepUp false — nothing to step up to) completes sign-in immediately; middleware routes them to enroll', async () => {
    authState.needsMfaStepUp = ref(false)
    const emitted = []
    const wrapper = mount(AuthForm, { props: { mode: 'signin' }, global: { stubs: STUBS }, attrs: { onAuthenticated: () => emitted.push(true) } })

    await fillAndSubmit(wrapper, 'admin@example.com', 'correct-password')

    expect(wrapper.find('[data-testid="mfa-challenge-stub"]').exists()).toBe(false)
    expect(emitted).toEqual([true])
  })

  it('a wrong password never reaches the MFA step at all', async () => {
    authState.signIn = vi.fn(async () => ({ error: 'Invalid login credentials' }))
    authState.needsMfaStepUp = ref(true)
    const wrapper = mount(AuthForm, { props: { mode: 'signin' }, global: { stubs: STUBS } })

    await fillAndSubmit(wrapper, 'admin@example.com', 'wrong-password')

    expect(wrapper.find('[data-testid="mfa-challenge-stub"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('email or password')
  })
})

describe('AuthForm — already signed in with a pending step-up (direct /login navigation)', () => {
  it('shows the MFA challenge immediately on mount, with no email/password submission needed', async () => {
    authState.isLoggedIn = ref(true)
    authState.needsMfaStepUp = ref(true)
    const wrapper = mount(AuthForm, { props: { mode: 'signin' }, global: { stubs: STUBS } })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="mfa-challenge-stub"]').exists()).toBe(true)
    expect(wrapper.find('input[type="email"]').exists()).toBe(false)
  })

  it('does NOT show the challenge on mount for the signup form (mode="signup")', async () => {
    authState.isLoggedIn = ref(true)
    authState.needsMfaStepUp = ref(true)
    const wrapper = mount(AuthForm, { props: { mode: 'signup' }, global: { stubs: STUBS } })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="mfa-challenge-stub"]').exists()).toBe(false)
  })
})
