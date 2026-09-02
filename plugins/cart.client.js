/**
 * Cart persistence — client only.
 *
 * Restores the saved cart into the shared `bm-cart` state BEFORE any watcher
 * runs, so the initial empty SSR state can never overwrite a saved cart. Only
 * once the saved value is restored do we start persisting future changes.
 *
 * This is the sole place localStorage is touched — swap it for another store
 * later without changing useCart() or any component.
 */
import { watch } from 'vue'
import { CART_STATE_KEY } from '~/composables/useCart'

const STORAGE_KEY = 'bm-cart'

export default defineNuxtPlugin(() => {
  // The same state the composable reads — mutate it directly here, not the
  // readonly `items` the composable returns.
  const cart = useState(CART_STATE_KEY, () => [])

  // 1. Read + parse, 2. validate it's an array, 3. assign to shared state.
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) cart.value = parsed
    }
  } catch {
    // corrupt / unavailable storage — carry on with an empty cart
  }

  // 4. Only now begin watching for future changes.
  watch(
    cart,
    (value) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      } catch {
        // private mode / quota exceeded — ignore, cart still works in-session
      }
    },
    { deep: true }
  )
})
