// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

/**
 * Phase 1 security hardening — component-level coverage for the admin
 * "continue session?" warning (AdminIdleWarningModal.vue), standing in for
 * a real-browser session since driving this against an actual admin login
 * would require a Supabase admin account (app_metadata.is_admin), which
 * isn't available for testing without writing one into production auth.
 *
 * useState/useNuxtApp are Nuxt auto-imports with no runtime here, so they're
 * stubbed as globals — same technique already used throughout this test
 * suite for Nitro's auto-imported server globals (defineEventHandler, etc).
 */

let warningState
let adminIdleGuard

function stubGlobals() {
  const registry = new Map()
  vi.stubGlobal('useState', (key, init) => {
    if (!registry.has(key)) registry.set(key, ref(init()))
    return registry.get(key)
  })
  warningState = () => [...registry.values()][0] // only one useState call in this component
  adminIdleGuard = { recordActivity: vi.fn(), signOutIdle: vi.fn() }
  vi.stubGlobal('useNuxtApp', () => ({ $adminIdleGuard: adminIdleGuard }))
}

let AdminIdleWarningModal

beforeEach(async () => {
  vi.useFakeTimers()
  stubGlobals()
  // Fresh module registry isn't needed — the component reads useState/useNuxtApp
  // at setup() time on each mount, so re-stubbing per test is sufficient.
  ;({ default: AdminIdleWarningModal } = await import('../components/admin/AdminIdleWarningModal.vue'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('AdminIdleWarningModal', () => {
  it('renders nothing while show is false', () => {
    const wrapper = mount(AdminIdleWarningModal)
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)
  })

  it('renders the warning with a live mm:ss countdown once show flips true', async () => {
    const wrapper = mount(AdminIdleWarningModal)
    const w = warningState()
    const now = Date.now()
    w.value = { show: true, expiresAt: now + 90 * 1000 } // 1m30s left
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('1m 30s')

    vi.setSystemTime(now + 31 * 1000) // jumps the clock 31s; the advance below adds 1 more
    vi.advanceTimersByTime(1000) // fires the component's own 1s display tick — 32s elapsed total, 58s left
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('58s')
  })

  it('"Continue session" calls recordActivity and hides the modal immediately', async () => {
    const wrapper = mount(AdminIdleWarningModal)
    const w = warningState()
    w.value = { show: true, expiresAt: Date.now() + 60 * 1000 }
    await wrapper.vm.$nextTick()

    await wrapper.find('button:not(.btn-outline)').trigger('click') // "Continue session" is the primary (non-outline) button
    expect(adminIdleGuard.recordActivity).toHaveBeenCalledTimes(1)
    expect(adminIdleGuard.signOutIdle).not.toHaveBeenCalled()
    expect(w.value.show).toBe(false)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)
  })

  it('"Log out now" calls signOutIdle without touching recordActivity', async () => {
    const wrapper = mount(AdminIdleWarningModal)
    const w = warningState()
    w.value = { show: true, expiresAt: Date.now() + 60 * 1000 }
    await wrapper.vm.$nextTick()

    await wrapper.find('button.btn-outline').trigger('click')
    expect(adminIdleGuard.signOutIdle).toHaveBeenCalledTimes(1)
    expect(adminIdleGuard.recordActivity).not.toHaveBeenCalled()
  })

  it('never throws if $adminIdleGuard is somehow unavailable (defensive optional-chaining)', async () => {
    vi.stubGlobal('useNuxtApp', () => ({}))
    const wrapper = mount(AdminIdleWarningModal)
    const w = warningState()
    w.value = { show: true, expiresAt: Date.now() + 60 * 1000 }
    await wrapper.vm.$nextTick()

    await expect(wrapper.find('button:not(.btn-outline)').trigger('click')).resolves.toBeUndefined()
  })
})
