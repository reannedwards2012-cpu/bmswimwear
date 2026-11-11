// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StepInvitation from '../components/bikini-mix/customer/StepInvitation.vue'

/**
 * Regression test for the "Up to 4 -> 6 pony beads" content-edit bug:
 * CATEGORY_MAP inside StepInvitation.vue keys its "Your Customizations"
 * grouping by the EXACT inclusion text. Editing that text in the database
 * without updating this map silently drops the item into a catch-all
 * "More" bucket instead of its real category/position — exactly what
 * happened live. This pins the current, real production inclusions list
 * (as of the fix) to its correct grouped shape.
 */
const REAL_PRODUCTION_INCLUSIONS = [
  'Your choice of bikini or one-piece swimsuit',
  'Straps included',
  'Up to 6 premium beads',
  'Up to 6 pony beads',
  '1 premium charm',
  '2 basic charms',
  '1 iron-on decal',
  'Up to 20 rhinestones',
  'Wine',
  'Finger foods'
]

const BASE_PROPS = {
  promoVideoUrl: null,
  isBookingsOpen: true,
  regularPriceXcdCents: 25000,
  ticketInclusions: REAL_PRODUCTION_INCLUSIONS
}

function openInclusions(wrapper) {
  return wrapper.find('button[aria-controls="inclusions-panel"]').trigger('click')
}

describe("StepInvitation — What's Included grouping", () => {
  it('groups "Up to 6 pony beads" into Your Customizations, as the 2nd item, right after premium beads', async () => {
    const wrapper = mount(StepInvitation, { props: BASE_PROPS })
    await openInclusions(wrapper)

    const groups = wrapper.findAll('#inclusions-panel p.text-mixer-coral')
    const customizations = groups.find((g) => g.text() === 'Your Customizations')
    expect(customizations).toBeTruthy()

    const itemsList = customizations.element.nextElementSibling
    const items = Array.from(itemsList.querySelectorAll('li')).map((li) => li.textContent.replace('✓', '').trim())
    expect(items[0]).toBe('Up to 6 premium beads')
    expect(items[1]).toBe('Up to 6 pony beads')
    expect(items).toEqual(['Up to 6 premium beads', 'Up to 6 pony beads', '1 premium charm', '2 basic charms', '1 iron-on decal', 'Up to 20 rhinestones'])
  })

  it('never creates a "More" section when every item has a known category', async () => {
    const wrapper = mount(StepInvitation, { props: BASE_PROPS })
    await openInclusions(wrapper)

    const groupNames = wrapper.findAll('#inclusions-panel p.text-mixer-coral').map((g) => g.text())
    expect(groupNames).not.toContain('More')
    expect(groupNames).toEqual(['Your Swimsuit', 'Your Customizations', 'Sips & Bites'])
  })

  it('an item with genuinely unrecognized text still falls back to "More" rather than being silently dropped', async () => {
    const wrapper = mount(StepInvitation, {
      props: { ...BASE_PROPS, ticketInclusions: [...REAL_PRODUCTION_INCLUSIONS, 'A brand new admin-added perk'] }
    })
    await openInclusions(wrapper)

    const groupNames = wrapper.findAll('#inclusions-panel p.text-mixer-coral').map((g) => g.text())
    expect(groupNames).toContain('More')
    expect(wrapper.text()).toContain('A brand new admin-added perk')
  })
})
