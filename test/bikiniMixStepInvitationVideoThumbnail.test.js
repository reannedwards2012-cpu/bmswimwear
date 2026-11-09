// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StepInvitation from '../components/bikini-mix/customer/StepInvitation.vue'
import GalleryGrid from '../components/bikini-mix/customer/GalleryGrid.vue'

// BikiniMixCustomerGalleryGrid is a Nuxt auto-imported component — the
// plain (non-Nuxt) Vue SFC compiler used here never resolves it from the
// tag name alone, so the real component is registered explicitly to
// exercise the actual prop/emit wiring between the two.
const GLOBAL_STUBS = { global: { components: { BikiniMixCustomerGalleryGrid: GalleryGrid } } }

const BASE_PROPS = {
  promoVideoUrl: 'https://proj.supabase.co/.../promo.mp4',
  isBookingsOpen: true,
  regularPriceXcdCents: 25000
}

describe('StepInvitation — custom video thumbnail / play overlay', () => {
  it('shows no play overlay when there is a video but no custom thumbnail (unchanged default behavior)', () => {
    const wrapper = mount(StepInvitation, { props: { ...BASE_PROPS, promoVideoThumbnailUrl: null } })
    expect(wrapper.find('video').exists()).toBe(true)
    expect(wrapper.find('video').attributes('poster')).toBeUndefined()
    expect(wrapper.find('button[aria-label="Play video"]').exists()).toBe(false)
  })

  it('sets the poster attribute and shows a centered play button when a thumbnail is set', () => {
    const wrapper = mount(StepInvitation, {
      props: { ...BASE_PROPS, promoVideoThumbnailUrl: 'https://proj.supabase.co/.../thumb.jpg' }
    })
    expect(wrapper.find('video').attributes('poster')).toBe('https://proj.supabase.co/.../thumb.jpg')
    expect(wrapper.find('button[aria-label="Play video"]').exists()).toBe(true)
  })

  it('hides the play overlay once the video reports its own "play" event, and never brings it back', async () => {
    const wrapper = mount(StepInvitation, {
      props: { ...BASE_PROPS, promoVideoThumbnailUrl: 'https://proj.supabase.co/.../thumb.jpg' }
    })
    expect(wrapper.find('button[aria-label="Play video"]').exists()).toBe(true)

    await wrapper.find('video').trigger('play')
    expect(wrapper.find('button[aria-label="Play video"]').exists()).toBe(false)

    await wrapper.find('video').trigger('pause')
    expect(wrapper.find('button[aria-label="Play video"]').exists()).toBe(false)
  })

  it('clicking the overlay calls play() on the underlying <video> element', async () => {
    const wrapper = mount(StepInvitation, {
      props: { ...BASE_PROPS, promoVideoThumbnailUrl: 'https://proj.supabase.co/.../thumb.jpg' },
      attachTo: document.body
    })
    const videoEl = wrapper.find('video').element
    let playCalled = false
    videoEl.play = () => { playCalled = true }

    await wrapper.find('button[aria-label="Play video"]').trigger('click')
    expect(playCalled).toBe(true)
    wrapper.unmount()
  })

  it('renders the "Get Inspired" gallery section with images passed through as props', () => {
    const images = [{ id: 'g1', imageUrl: 'https://example.test/1.jpg', caption: 'Gold strap', includedInTicket: false }]
    const wrapper = mount(StepInvitation, { props: { ...BASE_PROPS, galleryImages: images }, ...GLOBAL_STUBS })
    expect(wrapper.text()).toContain('Get Inspired')
    expect(wrapper.findAll('img').some((img) => img.attributes('src') === 'https://example.test/1.jpg')).toBe(true)
  })

  it('bubbles a gallery image click up as "open-gallery-at" with the clicked index', async () => {
    const images = Array.from({ length: 2 }, (_, i) => ({ id: `g${i}`, imageUrl: `https://example.test/${i}.jpg`, caption: `Photo ${i}`, includedInTicket: false }))
    const wrapper = mount(StepInvitation, { props: { ...BASE_PROPS, galleryImages: images }, ...GLOBAL_STUBS })

    const tiles = wrapper.findAll('button[aria-label^="View"]')
    await tiles[1].trigger('click')

    expect(wrapper.emitted('open-gallery-at')[0]).toEqual([1])
  })
})
