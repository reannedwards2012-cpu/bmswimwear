// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

/**
 * Phase 2 follow-up — pages/admin/orders/[id].vue's background signed-URL
 * refresh (refreshImageUrls, on a 20-min timer) must:
 *   1. Only ever update images, scoped to THIS order.
 *   2. Never disturb the unsaved adminNotesDraft textarea — which is
 *      reactively re-seeded by `watch(order, ...)` whenever `data.value`
 *      changes identity, so the refresh must never touch `data`/`order`.
 *   3. Degrade gracefully (leave current images as-is) on a failed refresh.
 *
 * Full page mount (shallow — child icon components stubbed) rather than a
 * reimplemented harness, so this exercises the actual reactive wiring in
 * the real file, not a stand-in that could drift from it.
 */

const ORDER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

function baseOrder(overrides = {}) {
  return {
    id: ORDER_ID,
    orderNumber: 'BM-000001',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status: 'paid',
    paidAt: '2026-01-01T00:00:00Z',
    archivedAt: null,
    source: 'instagram',
    isManual: true,
    availableTransitions: [],
    currency: 'USD',
    paymentMethod: null,
    subtotalUsdCents: 10000,
    subtotalXcdCents: null,
    shippingUsdCents: 0,
    totalUsdCents: 10000,
    shippingZone: null,
    billableWeightLb: null,
    marketingOptIn: false,
    customer: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '' },
    delivery: {
      deliveryMethod: 'local_delivery', deliveryLabel: 'Local', shippingZone: null, zoneLabel: '',
      shippingCountry: 'Grenada', shippingAddress1: '', shippingAddress2: '', shippingCity: '', shippingRegion: '', shippingPostalCode: ''
    },
    notes: '',
    adminNotes: 'Original saved note',
    paymentId: null,
    items: [{ id: 'item-1', productName: 'Custom bikini', image: 'https://signed.example/original.jpg', description: null, isCustom: true, quantity: 1, size: 'M', colourName: 'Coral', coverage: 'bikini', unitPriceUsdCents: 10000, unitPriceXcdCents: null }],
    ...overrides
  }
}

let fetchCalls
let fetchImpl

function stubGlobals() {
  vi.stubGlobal('definePageMeta', () => {})
  vi.stubGlobal('useHead', () => {})
  vi.stubGlobal('useRoute', () => ({ params: { id: ORDER_ID }, fullPath: `/admin/orders/${ORDER_ID}` }))
  vi.stubGlobal('useRouter', () => ({ push: vi.fn() }))
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

let OrderDetailPage

beforeEach(async () => {
  vi.useFakeTimers()
  stubGlobals()
  fetchImpl = async (url) => {
    if (url === `/api/admin/orders/${ORDER_ID}`) return { order: baseOrder() }
    throw new Error(`unexpected fetch ${url}`)
  }
  ;({ default: OrderDetailPage } = await import('../pages/admin/orders/[id].vue'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function mountAndLoad() {
  const wrapper = mount(OrderDetailPage, { shallow: true })
  await vi.waitFor(() => expect(wrapper.find('textarea').exists()).toBe(true))
  await wrapper.vm.$nextTick()
  return wrapper
}

describe('admin order detail — background image-URL refresh', () => {
  it('renews the image via the lightweight per-order endpoint, scoped to THIS order id, without re-fetching the order itself', async () => {
    fetchImpl = async (url) => {
      if (url === `/api/admin/orders/${ORDER_ID}`) return { order: baseOrder() }
      if (url === `/api/admin/orders/${ORDER_ID}/image-urls`) return { images: [{ id: 'item-1', image: 'https://signed.example/renewed.jpg' }] }
      throw new Error(`unexpected fetch ${url}`)
    }
    const wrapper = await mountAndLoad()

    await vi.advanceTimersByTimeAsync(20 * 60 * 1000)
    await wrapper.vm.$nextTick()

    expect(fetchCalls.some((c) => c.url === `/api/admin/orders/${ORDER_ID}/image-urls`)).toBe(true)
    // never re-fetched the full order detail a second time for this
    expect(fetchCalls.filter((c) => c.url === `/api/admin/orders/${ORDER_ID}`)).toHaveLength(1)
    expect(wrapper.find('img').attributes('src')).toBe('https://signed.example/renewed.jpg')
  })

  it("preserves an UNSAVED admin-notes edit across a background refresh — the refresh never touches data.value/order, so the adminNotes watch never re-fires", async () => {
    fetchImpl = async (url) => {
      if (url === `/api/admin/orders/${ORDER_ID}`) return { order: baseOrder() }
      if (url === `/api/admin/orders/${ORDER_ID}/image-urls`) return { images: [{ id: 'item-1', image: 'https://signed.example/renewed.jpg' }] }
      throw new Error(`unexpected fetch ${url}`)
    }
    const wrapper = await mountAndLoad()

    const textarea = wrapper.find('textarea')
    expect(textarea.element.value).toBe('Original saved note')
    await textarea.setValue('An in-progress edit the admin has NOT saved yet')

    await vi.advanceTimersByTimeAsync(20 * 60 * 1000)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('textarea').element.value).toBe('An in-progress edit the admin has NOT saved yet')
  })

  it('a failed refresh leaves the current image untouched (never nulls/breaks it) and does not throw', async () => {
    fetchImpl = async (url) => {
      if (url === `/api/admin/orders/${ORDER_ID}`) return { order: baseOrder() }
      if (url === `/api/admin/orders/${ORDER_ID}/image-urls`) throw Object.assign(new Error('network blip'), { data: { error: 'network blip' } })
      throw new Error(`unexpected fetch ${url}`)
    }
    const wrapper = await mountAndLoad()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await vi.advanceTimersByTimeAsync(20 * 60 * 1000)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('img').attributes('src')).toBe('https://signed.example/original.jpg')
    expect(warnSpy).toHaveBeenCalled()
  })

  it('stops refreshing once the page unmounts (no stray timer/fetch after navigating away)', async () => {
    fetchImpl = async (url) => {
      if (url === `/api/admin/orders/${ORDER_ID}`) return { order: baseOrder() }
      if (url === `/api/admin/orders/${ORDER_ID}/image-urls`) return { images: [{ id: 'item-1', image: 'https://signed.example/renewed.jpg' }] }
      throw new Error(`unexpected fetch ${url}`)
    }
    const wrapper = await mountAndLoad()
    wrapper.unmount()

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

    expect(fetchCalls.some((c) => c.url === `/api/admin/orders/${ORDER_ID}/image-urls`)).toBe(false)
  })
})
