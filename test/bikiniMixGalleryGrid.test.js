// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GalleryGrid from '../components/bikini-mix/customer/GalleryGrid.vue'

const IMG = (i, overrides = {}) => ({ id: `g${i}`, imageUrl: `https://example.test/${i}.jpg`, caption: `Photo ${i}`, includedInTicket: false, ...overrides })

describe('GalleryGrid — the "Get Inspired" inline gallery section', () => {
  it('shows a loading state while pending', () => {
    const wrapper = mount(GalleryGrid, { props: { images: [], pending: true } })
    expect(wrapper.text()).toContain('Loading')
  })

  it('shows an error state with a retry control that emits "retry"', async () => {
    const wrapper = mount(GalleryGrid, { props: { images: [], error: new Error('network down') } })
    expect(wrapper.text()).toContain("Couldn't load")
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('retry')).toBeTruthy()
  })

  it('shows an empty-but-not-errored state', () => {
    const wrapper = mount(GalleryGrid, { props: { images: [] } })
    expect(wrapper.text()).toContain('coming soon')
  })

  it('renders every image up to the initial cap, with no "view more" control when there are few', () => {
    const images = Array.from({ length: 4 }, (_, i) => IMG(i))
    const wrapper = mount(GalleryGrid, { props: { images } })
    expect(wrapper.findAll('img')).toHaveLength(4)
    expect(wrapper.text()).not.toContain('View more')
  })

  it('caps the initial grid at 8 and reveals the rest only after "View more" is clicked', async () => {
    const images = Array.from({ length: 12 }, (_, i) => IMG(i))
    const wrapper = mount(GalleryGrid, { props: { images } })

    expect(wrapper.findAll('img')).toHaveLength(8)
    expect(wrapper.text()).toContain('4 more')

    const moreBtn = wrapper.findAll('button').find((b) => b.text().includes('View more'))
    await moreBtn.trigger('click')

    expect(wrapper.findAll('img')).toHaveLength(12)
    expect(wrapper.text()).not.toContain('View more')
  })

  it('clicking an image emits "open" with its real index in the full images array', async () => {
    const images = Array.from({ length: 4 }, (_, i) => IMG(i))
    const wrapper = mount(GalleryGrid, { props: { images } })

    const tiles = wrapper.findAll('button[aria-label^="View"]')
    await tiles[2].trigger('click')

    expect(wrapper.emitted('open')[0]).toEqual([2])
  })

  it('shows "Included" vs "Add at event" badges based on includedInTicket', () => {
    const images = [IMG(0, { includedInTicket: true }), IMG(1, { includedInTicket: false })]
    const wrapper = mount(GalleryGrid, { props: { images } })
    expect(wrapper.text()).toContain('Included')
    expect(wrapper.text()).toContain('Add at event')
  })

  it('shows the heading with its descriptive text beneath it', () => {
    const wrapper = mount(GalleryGrid, { props: { images: [IMG(0)] } })
    expect(wrapper.text()).toContain('Get Inspired')
    expect(wrapper.text()).toContain('Explore some of the charms, beads and other details')
  })
})
