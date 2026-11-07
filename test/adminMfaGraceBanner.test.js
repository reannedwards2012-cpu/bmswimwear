// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

/**
 * Phase 3 (MFA) follow-up — AdminMfaGraceBanner.vue only ever matters
 * during ADMIN_MFA_ENFORCEMENT=grace (strict mode would already have
 * redirected a never-enrolled admin away via middleware before any other
 * page — including this banner — gets a chance to render). Confirms it
 * shows exactly when needed, nowhere else, and never on /admin/security
 * itself (that page already explains the same thing in its own UI).
 */

let authState

function stubGlobals(path) {
  vi.stubGlobal('useAuth', () => authState)
  vi.stubGlobal('useRoute', () => ({ path }))
}

let AdminMfaGraceBanner

beforeEach(async () => {
  authState = { needsMfaEnrollment: ref(false) }
  ;({ default: AdminMfaGraceBanner } = await import('../components/admin/AdminMfaGraceBanner.vue'))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('AdminMfaGraceBanner', () => {
  it('renders nothing when MFA enrollment is satisfied', () => {
    stubGlobals('/admin/orders')
    authState.needsMfaEnrollment.value = false
    const wrapper = mount(AdminMfaGraceBanner)
    expect(wrapper.text()).toBe('')
  })

  it('shows the nudge + link while enrollment is still pending', () => {
    stubGlobals('/admin/orders')
    authState.needsMfaEnrollment.value = true
    const wrapper = mount(AdminMfaGraceBanner, {
      global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } }
    })
    expect(wrapper.text()).toContain('Set it up now')
    expect(wrapper.find('a[href="/admin/security"]').exists()).toBe(true)
  })

  it('never shows on /admin/security itself, even if still pending — that page already covers it', () => {
    stubGlobals('/admin/security')
    authState.needsMfaEnrollment.value = true
    const wrapper = mount(AdminMfaGraceBanner)
    expect(wrapper.text()).toBe('')
  })
})
