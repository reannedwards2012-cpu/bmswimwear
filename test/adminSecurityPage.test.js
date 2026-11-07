// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

/**
 * Phase 3 (MFA) — pages/admin/security.vue: the mandatory-enrollment and
 * ongoing-management page. Covers the explicit testing asks: successful
 * enrollment, an incorrect verification code, and (implementation detail
 * worth locking down) that cancelling a half-finished enrollment cleans up
 * the abandoned unverified factor rather than leaving it dangling.
 */

let authState

function stubGlobals() {
  vi.stubGlobal('definePageMeta', () => {})
  vi.stubGlobal('useHead', () => {})
  vi.stubGlobal('useAuth', () => authState)
}

let SecurityPage

beforeEach(async () => {
  authState = {
    listTotpFactors: vi.fn(async () => ({ factors: [], error: null })),
    enrollTotp: vi.fn(async () => ({ error: null, factorId: 'factor-1', qrCode: 'data:image/svg+xml,...', secret: 'ABCD1234', uri: 'otpauth://...' })),
    verifyTotp: vi.fn(async () => ({ error: null })),
    unenrollTotp: vi.fn(async () => ({ error: null }))
  }
  stubGlobals()
  ;({ default: SecurityPage } = await import('../pages/admin/security.vue'))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function mountAndWaitForLoad() {
  const wrapper = mount(SecurityPage, { global: { stubs: { FancyHeading: true } } })
  await vi.waitFor(() => expect(wrapper.text()).not.toContain('Loading'))
  return wrapper
}

describe('admin security page — first-time enrollment', () => {
  it('shows the "begin setup" state when nothing is enrolled yet', async () => {
    const wrapper = await mountAndWaitForLoad()
    expect(wrapper.text()).toContain('Begin setup')
  })

  it('begin setup shows the QR code and setup key', async () => {
    const wrapper = await mountAndWaitForLoad()
    await wrapper.find('button').trigger('click') // "Begin setup"
    await wrapper.vm.$nextTick()

    expect(authState.enrollTotp).toHaveBeenCalledWith('Authenticator app')
    expect(wrapper.find('img').attributes('src')).toBe('data:image/svg+xml,...')
    expect(wrapper.text()).toContain('ABCD1234')
  })

  it('a correct 6-digit code completes enrollment and shows the "enabled" state', async () => {
    const wrapper = await mountAndWaitForLoad()
    await wrapper.find('button').trigger('click')
    await wrapper.vm.$nextTick()

    // The component already holds this exact mock reference from setup —
    // reassigning authState.listTotpFactors to a brand-new fn now wouldn't
    // reach it, so the next call is overridden in place instead.
    authState.listTotpFactors.mockResolvedValueOnce({ factors: [{ id: 'factor-1', status: 'verified', created_at: '2026-01-01T00:00:00Z' }], error: null })
    await wrapper.find('input').setValue('123456')
    await wrapper.find('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()

    expect(authState.verifyTotp).toHaveBeenCalledWith('factor-1', '123456')
    expect(wrapper.text()).toContain('is enabled')
  })

  it('an incorrect code shows a clear error and stays on the QR/code-entry step', async () => {
    authState.verifyTotp = vi.fn(async () => ({ error: 'Invalid TOTP code entered' }))
    const wrapper = await mountAndWaitForLoad()
    await wrapper.find('button').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('input').setValue('000000')
    await wrapper.find('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('isn’t right')
    expect(wrapper.find('img').exists()).toBe(true) // still mid-enrollment, not bounced back to "begin setup"
  })

  it('cancelling a half-finished enrollment removes the dangling unverified factor', async () => {
    const wrapper = await mountAndWaitForLoad()
    await wrapper.find('button').trigger('click')
    await wrapper.vm.$nextTick()

    const cancelBtn = wrapper.findAll('button').find((b) => b.text() === 'Cancel')
    await cancelBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(authState.unenrollTotp).toHaveBeenCalledWith('factor-1')
    expect(wrapper.text()).toContain('Begin setup') // back to the start, not stuck
  })

  it('an enroll() failure shows a message rather than silently doing nothing', async () => {
    authState.enrollTotp = vi.fn(async () => ({ error: 'Something went wrong' }))
    const wrapper = await mountAndWaitForLoad()
    await wrapper.find('button').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Something went wrong')
    expect(wrapper.find('img').exists()).toBe(false) // never entered the QR step
  })
})

describe('admin security page — already enrolled', () => {
  beforeEach(() => {
    authState.listTotpFactors = vi.fn(async () => ({ factors: [{ id: 'factor-1', status: 'verified', created_at: '2026-01-01T00:00:00Z' }], error: null }))
  })

  it('shows the enabled status, not the setup flow', async () => {
    const wrapper = await mountAndWaitForLoad()
    expect(wrapper.text()).toContain('is enabled')
    expect(wrapper.text()).not.toContain('Begin setup')
  })

  it('removing requires an explicit confirm step, then calls unenrollTotp with the factor id', async () => {
    const wrapper = await mountAndWaitForLoad()
    await wrapper.find('button').trigger('click') // "Remove and set up again"
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('immediately removes')

    authState.listTotpFactors.mockResolvedValueOnce({ factors: [], error: null })
    const removeBtn = wrapper.findAll('button').find((b) => b.text() === 'Remove it')
    await removeBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(authState.unenrollTotp).toHaveBeenCalledWith('factor-1')
    expect(wrapper.text()).toContain('Begin setup') // back to needing enrollment
  })
})
