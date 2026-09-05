<template>
  <div class="section container-bm">
    <div class="mx-auto max-w-lg text-center">
      <p class="eyebrow">Checkout</p>
      <h1 class="mt-2 font-display text-3xl font-semibold text-ink md:text-4xl">
        {{ confirmed ? 'Payment Confirmed' : 'Payment Received' }}
      </h1>

      <p class="mt-4 leading-relaxed text-ink/70">
        <template v-if="confirmed">
          Thank you! Your payment is confirmed and your made-to-order pieces are now in
          production — {{ turnaround }}. A confirmation email is on its way.
        </template>
        <template v-else>
          Thanks! We’ve received your payment and are just confirming it. You’ll get a
          confirmation email shortly — there’s no need to pay again.
        </template>
      </p>

      <p v-if="orderRef" class="mt-3 text-sm text-ink/45">Order reference: {{ orderRef }}</p>

      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <NuxtLink to="/shop" class="btn-primary">Continue shopping</NuxtLink>
        <NuxtLink to="/" class="btn-outline">Back to home</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { MADE_TO_ORDER } from '~/data/constants.js'
import { useCheckout } from '~/composables/useCheckout'

useHead({ title: 'Payment received — Bahama Mama Swimwear' })

const route = useRoute()
const turnaround = MADE_TO_ORDER.turnaround

// Display order number only (e.g. BM-000123) — never an internal id.
const orderRef = computed(() => {
  const o = route.query.o
  return typeof o === 'string' && /^BM-\d{6}$/.test(o) ? o : ''
})

const { clear } = useCart()
const { readCheckoutId, clearCheckoutId } = useCheckout()

const confirmed = ref(false)
let timer
let attempts = 0

// The browser never sees order status directly — only { paid: boolean } keyed
// by this tab's checkout id. Cart clears only once the server (post callback
// verification) reports paid.
async function checkPaid() {
  const id = readCheckoutId()
  if (!id) return

  try {
    const { paid } = await $fetch('/api/checkout/status', { params: { checkout: id } })
    if (paid) {
      confirmed.value = true
      clear()
      clearCheckoutId()
      return
    }
  } catch {
    /* transient — keep polling */
  }

  attempts += 1
  if (attempts < 5) timer = setTimeout(checkPaid, 3000)
}

onMounted(() => {
  checkPaid()
})
onBeforeUnmount(() => clearTimeout(timer))
</script>
