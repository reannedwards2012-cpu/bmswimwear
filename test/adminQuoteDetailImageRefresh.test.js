// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

/**
 * Phase 2 follow-up — pages/admin/quotes/[id].vue's background signed-URL
 * refresh (refreshImageUrls, on a 20-min timer) must be scoped to THIS
 * quote id and degrade gracefully on failure. It pushes results into
 * AdminQuoteCalculatorForm via the `livePreviewUrls` prop rather than
 * touching `data.value`/`quote` — this page-level test proves the PAGE's
 * half of that contract (scoping + failure handling); the form's own half
 * (unsaved-field survival, the length-mismatch guard) is covered directly
 * in test/quoteCalculatorFormImagePreview.test.js. AdminQuoteCalculatorForm
 * itself is stubbed here (shallow) — only its received props matter for
 * this test.
 */

const QUOTE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

const baseQuote = () => ({
  id: QUOTE_ID, quoteNumber: 'QT-000001', status: 'draft', customerName: 'Jane',
  inspirationImageUrls: ['stored-a'], inspirationImagePreviewUrls: ['signed-a']
})

let fetchCalls
let fetchImpl

function stubGlobals() {
  vi.stubGlobal('definePageMeta', () => {})
  vi.stubGlobal('useHead', () => {})
  vi.stubGlobal('useRoute', () => ({ params: { id: QUOTE_ID } }))
  vi.stubGlobal('useAuth', () => ({ getAccessToken: async () => 'fake-token' }))
  vi.stubGlobal('useLazyAsyncData', (key, fetcher) => {
    const data = ref(null)
    const pending = ref(true)
    const error = ref(null)
    async function run() {
      pending.value = true
      try {
        data.value = await fetcher()
        error.value = null
      } catch (err) {
        error.value = err
      } finally {
        pending.value = false
      }
    }
    run()
    return { data, pending, error, refresh: run }
  })

  fetchCalls = []
  vi.stubGlobal('$fetch', async (url, opts) => {
    fetchCalls.push({ url, opts })
    return fetchImpl(url, opts)
  })
}

let QuoteDetailPage

beforeEach(async () => {
  vi.useFakeTimers()
  stubGlobals()
  fetchImpl = async (url) => {
    if (url === `/api/admin/quotes/${QUOTE_ID}`) return { quote: baseQuote() }
    if (url === '/api/admin/quotes/settings') return { settings: {} }
    if (url === '/api/admin/fabrics') return { fabrics: [] }
    throw new Error(`unexpected fetch ${url}`)
  }
  ;({ default: QuoteDetailPage } = await import('../pages/admin/quotes/[id].vue'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// These are Nuxt auto-imported components — the page's template references
// them with no explicit <script> import, so the plain (non-Nuxt) Vue SFC
// compiler used by vitest here never resolves them at all. Named stubs so
// findComponent({ name }) can still locate AdminQuoteCalculatorForm's props.
const STUBS = {
  FancyHeading: { template: '<div />' },
  AdminQuoteSubNav: { template: '<div />' },
  AdminQuoteStatusBadge: { template: '<div />' },
  AdminQuoteCalculatorForm: { name: 'AdminQuoteCalculatorForm', props: ['livePreviewUrls'], template: '<div />' }
}

async function mountAndLoad() {
  const wrapper = mount(QuoteDetailPage, { global: { stubs: STUBS } })
  await vi.waitFor(() => expect(wrapper.findComponent({ name: 'AdminQuoteCalculatorForm' }).exists()).toBe(true))
  await wrapper.vm.$nextTick()
  return wrapper
}

describe('admin quote detail — background image-URL refresh', () => {
  it('renews via the lightweight per-quote endpoint, scoped to THIS quote id, and pushes it into the form as livePreviewUrls', async () => {
    fetchImpl = async (url) => {
      if (url === `/api/admin/quotes/${QUOTE_ID}`) return { quote: baseQuote() }
      if (url === '/api/admin/quotes/settings') return { settings: {} }
      if (url === '/api/admin/fabrics') return { fabrics: [] }
      if (url === `/api/admin/quotes/${QUOTE_ID}/image-urls`) return { previewUrls: ['renewed-a'] }
      throw new Error(`unexpected fetch ${url}`)
    }
    const wrapper = await mountAndLoad()

    await vi.advanceTimersByTimeAsync(20 * 60 * 1000)
    await wrapper.vm.$nextTick()

    expect(fetchCalls.some((c) => c.url === `/api/admin/quotes/${QUOTE_ID}/image-urls`)).toBe(true)
    expect(fetchCalls.filter((c) => c.url === `/api/admin/quotes/${QUOTE_ID}`)).toHaveLength(1) // never re-fetched the quote itself
    expect(wrapper.findComponent({ name: 'AdminQuoteCalculatorForm' }).props('livePreviewUrls')).toEqual(['renewed-a'])
  })

  it('a failed refresh leaves livePreviewUrls at its previous value (never throws)', async () => {
    fetchImpl = async (url) => {
      if (url === `/api/admin/quotes/${QUOTE_ID}`) return { quote: baseQuote() }
      if (url === '/api/admin/quotes/settings') return { settings: {} }
      if (url === '/api/admin/fabrics') return { fabrics: [] }
      if (url === `/api/admin/quotes/${QUOTE_ID}/image-urls`) throw new Error('network blip')
      throw new Error(`unexpected fetch ${url}`)
    }
    const wrapper = await mountAndLoad()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(wrapper.findComponent({ name: 'AdminQuoteCalculatorForm' }).props('livePreviewUrls')).toBeNull()

    await vi.advanceTimersByTimeAsync(20 * 60 * 1000)
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent({ name: 'AdminQuoteCalculatorForm' }).props('livePreviewUrls')).toBeNull()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('stops refreshing once the page unmounts', async () => {
    fetchImpl = async (url) => {
      if (url === `/api/admin/quotes/${QUOTE_ID}`) return { quote: baseQuote() }
      if (url === '/api/admin/quotes/settings') return { settings: {} }
      if (url === '/api/admin/fabrics') return { fabrics: [] }
      if (url === `/api/admin/quotes/${QUOTE_ID}/image-urls`) return { previewUrls: ['renewed-a'] }
      throw new Error(`unexpected fetch ${url}`)
    }
    const wrapper = await mountAndLoad()
    wrapper.unmount()

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

    expect(fetchCalls.some((c) => c.url === `/api/admin/quotes/${QUOTE_ID}/image-urls`)).toBe(false)
  })
})
