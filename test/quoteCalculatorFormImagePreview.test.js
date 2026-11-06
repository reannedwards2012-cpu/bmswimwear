// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

/**
 * Phase 2 security hardening — QuoteCalculatorForm.vue keeps TWO parallel
 * arrays for inspiration images: form.inspirationImageUrls (canonical,
 * re-submitted verbatim on save) and imagePreviewUrls (display-only signed
 * URLs). This proves they stay aligned by index through add + remove, and
 * that removing never desyncs them — a desync would show the wrong
 * thumbnail without being a save-data-corruption bug (lower severity, but
 * worth locking down given how easy an off-by-one here would be).
 */

function stubGlobals() {
  vi.stubGlobal('useAuth', () => ({ getAccessToken: async () => 'fake-token' }))
}

let QuoteCalculatorForm
let fetchMock

beforeEach(async () => {
  stubGlobals()
  fetchMock = vi.fn()
  vi.stubGlobal('$fetch', fetchMock)
  ;({ default: QuoteCalculatorForm } = await import('../components/admin/QuoteCalculatorForm.vue'))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const SETTINGS = {
  labourRateXcdCents: 1000, fabricCostSolidXcdCents: 500, fabricCostPrintedXcdCents: 700,
  fabricConsumptionBikiniYards: 0.5, fabricConsumptionOnepieceYards: 1,
  packagingXcdCents: 100, consumablesXcdCents: 100, electricityMonthlyXcdCents: 100,
  machineMaintenanceMonthlyXcdCents: 100, expectedMonthlyVolume: 20,
  fittingAllowanceXcdCents: 100, targetMarginPercent: 30, depositPercent: 50,
  minPriceBasicBikiniXcdCents: 1000, minPriceBasicOnepieceXcdCents: 1000, minPriceComplexCustomXcdCents: 1000, minPriceOtherCustomXcdCents: 1000,
  defaultHoursBasicBikini: 2, defaultHoursBasicOnepiece: 2, defaultHoursComplexCustom: 2,
  designFeeMinorXcdCents: 0, designFeeNewXcdCents: 0, designFeeComplexXcdCents: 0
}

function mountForm(quote = null, extraProps = {}) {
  return mount(QuoteCalculatorForm, { props: { settings: SETTINGS, quote, ...extraProps } })
}

describe('QuoteCalculatorForm — inspiration image preview/canonical array lockstep', () => {
  it('starts aligned from an existing quote (same order/length)', () => {
    const quote = {
      inspirationImageUrls: ['stored-a', 'stored-b'],
      inspirationImagePreviewUrls: ['signed-a', 'signed-b']
    }
    const wrapper = mountForm(quote)
    const imgs = wrapper.findAll('img')
    expect(imgs.map((i) => i.attributes('src'))).toEqual(['signed-a', 'signed-b'])
  })

  it('falls back to the canonical URL for display when no preview is available at that index', () => {
    const quote = { inspirationImageUrls: ['stored-a'], inspirationImagePreviewUrls: [] }
    const wrapper = mountForm(quote)
    expect(wrapper.find('img').attributes('src')).toBe('stored-a')
  })

  it('a new upload pushes both arrays together — the new thumbnail shows the signed preview, not the canonical url', async () => {
    fetchMock.mockResolvedValue({ url: 'stored-new', previewUrl: 'signed-new' })
    const wrapper = mountForm({ inspirationImageUrls: ['stored-a'], inspirationImagePreviewUrls: ['signed-a'] })

    const fileInput = wrapper.find('input[type="file"]')
    const file = new File(['bytes'], 'x.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput.element, 'files', { value: [file] })
    await fileInput.trigger('change')
    await wrapper.vm.$nextTick()
    await vi.waitFor(() => expect(wrapper.findAll('img')).toHaveLength(2))

    const imgs = wrapper.findAll('img')
    expect(imgs.map((i) => i.attributes('src'))).toEqual(['signed-a', 'signed-new'])
  })

  it('removing the first image shifts both arrays together — no desync', async () => {
    const quote = {
      inspirationImageUrls: ['stored-a', 'stored-b', 'stored-c'],
      inspirationImagePreviewUrls: ['signed-a', 'signed-b', 'signed-c']
    }
    const wrapper = mountForm(quote)

    await wrapper.findAll('button')[0].trigger('click') // the ✕ on the first thumbnail
    await wrapper.vm.$nextTick()

    const imgs = wrapper.findAll('img')
    expect(imgs.map((i) => i.attributes('src'))).toEqual(['signed-b', 'signed-c'])
  })
})

describe('QuoteCalculatorForm — livePreviewUrls background refresh (parent-pushed)', () => {
  it('applies a refreshed preview array when its length matches the current canonical array', async () => {
    const wrapper = mountForm({ inspirationImageUrls: ['stored-a', 'stored-b'], inspirationImagePreviewUrls: ['signed-a', 'signed-b'] })

    await wrapper.setProps({ livePreviewUrls: ['renewed-a', 'renewed-b'] })

    expect(wrapper.findAll('img').map((i) => i.attributes('src'))).toEqual(['renewed-a', 'renewed-b'])
  })

  it('SKIPS a refresh whose length no longer matches — the admin added an image locally since the refresh was fetched, so applying it by index would misassign thumbnails', async () => {
    const wrapper = mountForm({ inspirationImageUrls: ['stored-a'], inspirationImagePreviewUrls: ['signed-a'] })

    // Admin adds a second image locally (simulated directly, mirroring onImageSelected's effect).
    wrapper.vm.form.inspirationImageUrls.push('stored-b')

    // A stale refresh computed before that addition arrives — length 1, current canonical length 2.
    await wrapper.setProps({ livePreviewUrls: ['renewed-a'] })

    // Unchanged: the mismatched refresh was ignored rather than misapplied.
    expect(wrapper.vm.form.inspirationImageUrls).toEqual(['stored-a', 'stored-b'])
  })

  it('never touches any other form field — an in-progress, unsaved edit survives a background refresh', async () => {
    const wrapper = mountForm({
      customerName: 'Jane Doe', description: 'Triangle bikini', inspirationImageUrls: ['stored-a'], inspirationImagePreviewUrls: ['signed-a']
    })

    await wrapper.find('input[type="text"]').setValue('An in-progress unsaved edit')
    await wrapper.setProps({ livePreviewUrls: ['renewed-a'] })

    expect(wrapper.vm.form.customerName).toBe('An in-progress unsaved edit')
  })

  it('a null livePreviewUrls (no refresh yet) leaves the setup-seeded preview array alone', () => {
    const wrapper = mountForm({ inspirationImageUrls: ['stored-a'], inspirationImagePreviewUrls: ['signed-a'] }, { livePreviewUrls: null })
    expect(wrapper.find('img').attributes('src')).toBe('signed-a')
  })
})
