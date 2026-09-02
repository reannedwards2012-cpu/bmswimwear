/**
 * Shopping cart — frontend-only for this phase.
 *
 * State lives in a single SSR-safe `useState('bm-cart')` array. Components use
 * this composable's API and never mutate the array directly (`items` is
 * readonly). Persistence to localStorage is wired separately in
 * `plugins/cart.client.js`, which reads/writes the same `bm-cart` state key —
 * so the storage mechanism can be swapped later without touching this file or
 * any component.
 *
 * A cart line is identified by product + the exact option combination
 * (`lineId`). Adding an identical combination bumps quantity; a different
 * combination is a separate line.
 */
import { computed, readonly } from 'vue'

export const CART_STATE_KEY = 'bm-cart'

/** Deterministic identity for a product + option combination. */
export function makeLineId({ productId, size, colourId, coverage }) {
  return [productId, size ?? '-', colourId ?? '-', coverage ?? '-'].join('::')
}

export function useCart() {
  const items = useState(CART_STATE_KEY, () => [])

  // UI state — the slide-out drawer + which line was most recently added.
  const drawerOpen = useState('bm-cart-drawer', () => false)
  const lastAddedLineId = useState('bm-cart-last-added', () => null)

  const totalUnits = computed(() => items.value.reduce((n, i) => n + i.quantity, 0))
  const subtotalUsd = computed(() =>
    items.value.reduce((sum, i) => sum + i.priceUsd * i.quantity, 0)
  )

  /**
   * Add a product with its selected options. `product` is a catalogue object
   * (from data/products.js); `options` carries the customer's picks.
   */
  function addItem(product, { size = null, colourId = null, colourName = null, coverage = null } = {}) {
    const lineId = makeLineId({ productId: product.id, size, colourId, coverage })
    const existing = items.value.find((i) => i.lineId === lineId)

    lastAddedLineId.value = lineId

    if (existing) {
      existing.quantity += 1
      return
    }

    items.value.push({
      lineId,
      productId: product.id,
      name: product.title,
      image: product.image,
      priceUsd: product.price,
      priceXcd: product.priceXcd,
      size,
      colourId,
      colourName,
      coverage,
      quantity: 1
    })
  }

  function increment(lineId) {
    const item = items.value.find((i) => i.lineId === lineId)
    if (item) item.quantity += 1
  }

  /** Decrease quantity, never below 1 — use removeItem to take a line out. */
  function decrement(lineId) {
    const item = items.value.find((i) => i.lineId === lineId)
    if (item && item.quantity > 1) item.quantity -= 1
  }

  function removeItem(lineId) {
    items.value = items.value.filter((i) => i.lineId !== lineId)
  }

  function clear() {
    items.value = []
  }

  const openDrawer = () => {
    drawerOpen.value = true
  }
  const closeDrawer = () => {
    drawerOpen.value = false
  }

  return {
    items: readonly(items),
    totalUnits,
    subtotalUsd,
    addItem,
    increment,
    decrement,
    removeItem,
    clear,
    isDrawerOpen: readonly(drawerOpen),
    lastAddedLineId: readonly(lastAddedLineId),
    openDrawer,
    closeDrawer
  }
}
