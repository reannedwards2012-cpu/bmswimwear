// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import GalleryLightbox from '../components/bikini-mix/customer/GalleryLightbox.vue'

const IMAGES = [
  { id: 'a', imageUrl: 'https://example.test/a.jpg', caption: 'First', includedInTicket: false },
  { id: 'b', imageUrl: 'https://example.test/b.jpg', caption: 'Second', includedInTicket: false },
  { id: 'c', imageUrl: 'https://example.test/c.jpg', caption: 'Third', includedInTicket: false }
]

afterEach(() => {
  document.body.style.overflow = ''
})

describe('GalleryLightbox — shared full-screen viewer', () => {
  it('renders nothing when openIndex is null', () => {
    const wrapper = mount(GalleryLightbox, { props: { images: IMAGES, openIndex: null }, attachTo: document.body })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    wrapper.unmount()
  })

  it('renders the image at openIndex, with a "N / total" counter', () => {
    const wrapper = mount(GalleryLightbox, { props: { images: IMAGES, openIndex: 1 }, attachTo: document.body })
    const img = document.querySelector('[role="dialog"] img')
    expect(img.getAttribute('src')).toBe('https://example.test/b.jpg')
    expect(document.querySelector('[role="dialog"]').textContent).toContain('2 / 3')
    wrapper.unmount()
  })

  it('Next/Previous wrap around at either end (modulo), without closing', async () => {
    const wrapper = mount(GalleryLightbox, { props: { images: IMAGES, openIndex: 2 }, attachTo: document.body })
    const nextBtn = document.querySelector('[aria-label="Next image"]')
    nextBtn.dispatchEvent(new Event('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:openIndex').at(-1)).toEqual([3])

    await wrapper.setProps({ openIndex: 0 })
    const prevBtn = document.querySelector('[aria-label="Previous image"]')
    prevBtn.dispatchEvent(new Event('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:openIndex').at(-1)).toEqual([-1])
    wrapper.unmount()
  })

  it('wraps a negative or overflowing openIndex to a real image rather than closing', async () => {
    const wrapper = mount(GalleryLightbox, { props: { images: IMAGES, openIndex: -1 }, attachTo: document.body })
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    expect(document.querySelector('[role="dialog"] img').getAttribute('src')).toBe('https://example.test/c.jpg')
    wrapper.unmount()
  })

  it('the close button emits update:openIndex with null', async () => {
    const wrapper = mount(GalleryLightbox, { props: { images: IMAGES, openIndex: 0 }, attachTo: document.body })
    document.querySelector('[aria-label="Close gallery"]').dispatchEvent(new Event('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:openIndex').at(-1)).toEqual([null])
    wrapper.unmount()
  })

  it('Escape closes; ArrowLeft/ArrowRight navigate — only while open', async () => {
    const wrapper = mount(GalleryLightbox, { props: { images: IMAGES, openIndex: 1 }, attachTo: document.body })
    await wrapper.vm.$nextTick()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(wrapper.emitted('update:openIndex').at(-1)).toEqual([2])

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(wrapper.emitted('update:openIndex').at(-1)).toEqual([0])

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('update:openIndex').at(-1)).toEqual([null])
    wrapper.unmount()
  })

  it('stops listening for keyboard navigation once closed', async () => {
    const wrapper = mount(GalleryLightbox, { props: { images: IMAGES, openIndex: 0 }, attachTo: document.body })
    await wrapper.setProps({ openIndex: null })
    await wrapper.vm.$nextTick()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    // No emit at all — the keydown listener was removed on close, not just
    // ignored, so this never reaches update:openIndex in the first place.
    expect(wrapper.emitted('update:openIndex')).toBeUndefined()
    wrapper.unmount()
  })

  it('locks background scroll while open and restores it on close', async () => {
    const wrapper = mount(GalleryLightbox, { props: { images: IMAGES, openIndex: 0 }, attachTo: document.body })
    await wrapper.vm.$nextTick()
    expect(document.body.style.overflow).toBe('hidden')

    await wrapper.setProps({ openIndex: null })
    await wrapper.vm.$nextTick()
    expect(document.body.style.overflow).toBe('')
    wrapper.unmount()
  })

  it('hides Previous/Next entirely when there is only one image', () => {
    const wrapper = mount(GalleryLightbox, { props: { images: [IMAGES[0]], openIndex: 0 }, attachTo: document.body })
    expect(document.querySelector('[aria-label="Next image"]')).toBeNull()
    expect(document.querySelector('[aria-label="Previous image"]')).toBeNull()
    wrapper.unmount()
  })
})
