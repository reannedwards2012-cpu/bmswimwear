<template>
  <!-- backdrop -->
  <Transition
    enter-active-class="transition-opacity duration-300 ease-out"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-200 ease-in"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isDrawerOpen"
      class="fixed inset-0 z-[60] bg-ink/40 backdrop-blur-sm"
      @click="closeDrawer"
    />
  </Transition>

  <!-- panel -->
  <Transition
    enter-active-class="transition-transform duration-300 ease-out"
    enter-from-class="translate-x-full"
    leave-active-class="transition-transform duration-200 ease-in"
    leave-to-class="translate-x-full"
  >
    <aside
      v-if="isDrawerOpen"
      class="fixed right-0 top-0 z-[70] flex h-full w-full max-w-md flex-col bg-cream shadow-[0_0_80px_-10px_rgba(27,42,47,0.45)]"
      role="dialog"
      aria-label="Shopping cart"
      @mouseenter="holdOpen"
      @focusin="holdOpen"
      @pointerdown="holdOpen"
    >
      <!-- header -->
      <div class="flex items-center justify-between border-b border-ink/10 px-5 py-4">
        <p class="font-display text-lg font-semibold text-ink">
          Your Cart
          <span v-if="totalUnits" class="text-ink/40">({{ totalUnits }})</span>
        </p>
        <button
          type="button"
          class="grid h-9 w-9 place-items-center rounded-full text-ink/60 transition-colors hover:bg-shell hover:text-ink"
          aria-label="Close cart"
          @click="closeDrawer"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <!-- empty -->
      <div v-if="!items.length" class="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
        <p class="text-ink/60">Your cart is empty.</p>
        <NuxtLink to="/shop" class="btn-primary" @click="closeDrawer">Shop swimwear</NuxtLink>
      </div>

      <!-- lines -->
      <ul v-else class="flex-1 divide-y divide-ink/10 overflow-y-auto px-5">
        <li
          v-for="item in items"
          :key="item.lineId"
          class="flex gap-4 py-5"
          :class="item.lineId === lastAddedLineId ? 'rounded-2xl ring-1 ring-coral/40' : ''"
        >
          <NuxtLink :to="`/shop/${item.productId}`" class="shrink-0" @click="closeDrawer">
            <img :src="item.image" :alt="item.name" class="aspect-[3/4] w-20 rounded-xl object-cover" />
          </NuxtLink>

          <div class="flex min-w-0 flex-1 flex-col">
            <div class="flex items-start justify-between gap-3">
              <NuxtLink
                :to="`/shop/${item.productId}`"
                class="font-display text-sm font-medium text-ink hover:text-coral"
                @click="closeDrawer"
              >
                {{ item.name }}
              </NuxtLink>
              <span class="shrink-0 text-sm font-semibold text-ink">{{ formatUsd(item.priceUsd) }}</span>
            </div>

            <p v-if="optionSummary(item)" class="mt-0.5 text-xs text-ink/55">{{ optionSummary(item) }}</p>
            <p v-if="item.lineId === lastAddedLineId" class="mt-0.5 text-[0.7rem] font-semibold uppercase tracking-widest2 text-coral">
              Just added
            </p>

            <div class="mt-auto flex items-center justify-between gap-2 pt-3">
              <div class="flex items-center rounded-full border border-ink/15">
                <button
                  type="button"
                  class="grid h-8 w-8 place-items-center rounded-full text-ink/70 transition-colors hover:text-ink disabled:opacity-30"
                  :disabled="item.quantity <= 1"
                  :aria-label="`Decrease ${item.name} quantity`"
                  @click="decrement(item.lineId)"
                >
                  &minus;
                </button>
                <span class="min-w-[2ch] text-center text-sm font-semibold text-ink">{{ item.quantity }}</span>
                <button
                  type="button"
                  class="grid h-8 w-8 place-items-center rounded-full text-ink/70 transition-colors hover:text-ink"
                  :aria-label="`Increase ${item.name} quantity`"
                  @click="increment(item.lineId)"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                class="text-[0.7rem] font-semibold uppercase tracking-widest2 text-ink/40 transition-colors hover:text-coral"
                @click="removeItem(item.lineId)"
              >
                Remove
              </button>
            </div>
          </div>
        </li>
      </ul>

      <!-- footer -->
      <div v-if="items.length" class="border-t border-ink/10 px-5 py-5">
        <div class="flex items-center justify-between text-sm">
          <span class="text-ink/60">Subtotal</span>
          <span class="font-semibold text-ink">USD {{ formatUsd(subtotalUsd) }}</span>
        </div>
        <p class="mt-1 text-xs text-ink/45">Made to order · {{ turnaround }}</p>

        <NuxtLink to="/checkout" class="btn-primary mt-4 block w-full text-center shadow-soft" @click="closeDrawer">
          Proceed to Checkout
        </NuxtLink>

        <div class="mt-3 flex items-center justify-center gap-4 text-xs">
          <NuxtLink to="/cart" class="font-semibold text-ink/50 hover:text-ink" @click="closeDrawer">
            View full cart
          </NuxtLink>
          <button type="button" class="text-ink/50 hover:text-ink" @click="closeDrawer">
            Continue shopping
          </button>
        </div>
      </div>
    </aside>
  </Transition>
</template>

<script setup>
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { formatUsd } from '~/utils/money'
import { MADE_TO_ORDER } from '~/data/constants.js'

const {
  items,
  totalUnits,
  subtotalUsd,
  isDrawerOpen,
  lastAddedLineId,
  closeDrawer,
  increment,
  decrement,
  removeItem
} = useCart()

const turnaround = MADE_TO_ORDER.turnaround

const optionSummary = (item) =>
  [item.size, item.colourName, item.coverage].filter(Boolean).join(' · ')

// Auto-dismiss ~5s after opening. Any interaction (hover, focus, tap, button
// press) holds it open permanently until the customer closes it themselves.
let timer
let held = false

const clearTimer = () => {
  clearTimeout(timer)
  timer = undefined
}
const armAutoClose = () => {
  if (held) return
  clearTimer()
  timer = setTimeout(() => closeDrawer(), 5000)
}
const holdOpen = () => {
  held = true
  clearTimer()
}

const lockScroll = (on) => {
  if (typeof document !== 'undefined') document.body.style.overflow = on ? 'hidden' : ''
}

watch(isDrawerOpen, (open) => {
  if (open) {
    held = false
    armAutoClose()
    lockScroll(true)
  } else {
    clearTimer()
    lockScroll(false)
  }
})

// A fresh add while the drawer is already open restarts the countdown,
// unless the customer has already interacted with it.
watch(lastAddedLineId, () => {
  if (isDrawerOpen.value) armAutoClose()
})

const onKey = (e) => {
  if (e.key === 'Escape') closeDrawer()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  clearTimer()
  lockScroll(false)
  window.removeEventListener('keydown', onKey)
})
</script>
