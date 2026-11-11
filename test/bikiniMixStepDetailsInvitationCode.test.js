// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

let StepDetails
let fetchMock

function baseModelValue(overrides = {}) {
  return {
    fullName: 'Jane Guest',
    email: 'jane@example.com',
    whatsapp: '+14735551234',
    bust: '',
    underbust: '',
    waist: '',
    hips: '',
    invitationCode: '',
    invitationCategory: null,
    company: '',
    ...overrides
  }
}

beforeEach(async () => {
  fetchMock = vi.fn()
  vi.stubGlobal('$fetch', fetchMock)
  ;({ default: StepDetails } = await import('../components/bikini-mix/customer/StepDetails.vue'))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('StepDetails — complimentary invitation code', () => {
  it('the code field is collapsed behind a link until opened', () => {
    const wrapper = mount(StepDetails, { props: { modelValue: baseModelValue() } })
    expect(wrapper.find('input[placeholder="e.g. ABCD-EFGH-JKLM"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Have an invitation code?')
  })

  it('applying a valid code calls the check endpoint and emits invitationCategory', async () => {
    fetchMock.mockResolvedValue({ valid: true, category: 'event_assistant', categoryLabel: 'Event Assistant' })
    const wrapper = mount(StepDetails, { props: { modelValue: baseModelValue() } })

    await wrapper.find('button').trigger('click') // "Have an invitation code?"
    await wrapper.find('input[placeholder="e.g. ABCD-EFGH-JKLM"]').setValue('ABCD-EFGH-JKLM')
    // No real parent to apply the v-model emit back automatically — simulate
    // it explicitly, the same way the real page re-renders with the patched object.
    await wrapper.setProps({ modelValue: wrapper.emitted('update:modelValue').at(-1)[0] })

    const applyBtn = wrapper.findAll('button').find((b) => b.text() === 'Apply')
    await applyBtn.trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/bikini-mix/invitation-code/check', { method: 'POST', body: { code: 'ABCD-EFGH-JKLM' } })
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted.at(-1)[0]).toMatchObject({ invitationCategory: 'event_assistant' })
  })

  it('shows an error and does not set invitationCategory for an invalid code', async () => {
    fetchMock.mockResolvedValue({ valid: false })
    const wrapper = mount(StepDetails, { props: { modelValue: baseModelValue() } })

    await wrapper.find('button').trigger('click')
    await wrapper.find('input[placeholder="e.g. ABCD-EFGH-JKLM"]').setValue('BADCODE')
    await wrapper.setProps({ modelValue: wrapper.emitted('update:modelValue').at(-1)[0] })

    const applyBtn = wrapper.findAll('button').find((b) => b.text() === 'Apply')
    await applyBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('invalid, expired, or has already been used')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted?.at(-1)?.[0]?.invitationCategory ?? null).toBeNull()
  })

  it('editing the code AFTER it was applied immediately clears invitationCategory — never shows a stale "applied" state', async () => {
    const wrapper = mount(StepDetails, { props: { modelValue: baseModelValue({ invitationCode: 'ABCD-EFGH-JKLM', invitationCategory: 'giveaway' }) } })
    expect(wrapper.text()).toContain('Giveaway invitation applied')

    await wrapper.find('input[placeholder="e.g. ABCD-EFGH-JKLM"]').setValue('ABCD-EFGH-JKLN')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted.at(-1)[0]).toMatchObject({ invitationCode: 'ABCD-EFGH-JKLN', invitationCategory: null })
  })

  it('never calls the check endpoint on every keystroke — only when Apply is clicked', async () => {
    const wrapper = mount(StepDetails, { props: { modelValue: baseModelValue() } })
    await wrapper.find('button').trigger('click')
    await wrapper.find('input[placeholder="e.g. ABCD-EFGH-JKLM"]').setValue('ABCD-EFGH-JKLM')

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
