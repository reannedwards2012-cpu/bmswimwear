<template>
  <div class="min-h-screen bg-sand">
    <div class="section container-bm max-w-2xl">
      <div v-if="phase === 'waiting'" class="mx-auto max-w-md text-center">
        <p class="eyebrow">The Bikini Mixer</p>
        <h1 class="mt-2 font-display text-3xl font-semibold text-ink md:text-4xl">Confirming your payment…</h1>
        <p class="mt-4 leading-relaxed text-ink/70">
          Thanks! We're just confirming your payment with Go2Pay — this usually takes a few seconds. There's no need
          to pay again or refresh.
        </p>
      </div>

      <div v-else-if="phase === 'timeout'" class="mx-auto max-w-md text-center">
        <p class="eyebrow">The Bikini Mixer</p>
        <h1 class="mt-2 font-display text-3xl font-semibold text-ink md:text-4xl">Still confirming…</h1>
        <p class="mt-4 leading-relaxed text-ink/70">
          Your payment is taking a little longer than usual to confirm. You don't need to pay again — we'll email you
          as soon as it's verified.
        </p>
        <p v-if="bookingRef" class="mt-3 text-sm text-ink/45">Booking reference: {{ bookingRef }}</p>
      </div>

      <div v-else class="mx-auto max-w-xl text-center">
        <p class="text-3xl">🍹</p>
        <h1 class="mt-3 font-display text-3xl font-semibold text-ink md:text-4xl">
          {{ confirmed ? "You're on the list!" : 'Payment Received' }}
        </h1>
        <p class="mt-4 leading-relaxed text-ink/70">
          <template v-if="confirmed">
            Your spot at {{ eventName }} is confirmed. We can't wait to see what you create! A confirmation email is
            on its way.
          </template>
          <template v-else>
            We've received and verified your payment. The event reached capacity right around when your payment came
            through, so we're confirming your spot by hand — we'll be in touch shortly, and your payment is safe
            either way.
          </template>
        </p>

        <div v-if="booking" class="mt-8 rounded-4xl bg-cream p-6 text-left shadow-card sm:p-8">
          <dl class="space-y-2 text-sm text-ink/70">
            <div class="flex justify-between gap-3"><dt class="text-ink/45">Booking reference</dt><dd class="font-semibold text-ink">{{ booking.bookingNumber }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-ink/45">Guest</dt><dd>{{ booking.fullName }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-ink/45">Package</dt><dd>{{ booking.package === 'the_works' ? 'The Works' : 'Classic Mix' }}</dd></div>
            <div v-if="booking.personalizationName" class="flex justify-between gap-3"><dt class="text-ink/45">Personalization</dt><dd>{{ booking.personalizationName }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-ink/45">Top</dt><dd>Size {{ booking.topSize }} — {{ booking.leftFabricName }} / {{ booking.rightFabricName }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-ink/45">Bottom</dt><dd>{{ booking.bottomStyle === 'tie-side' ? 'Tie-Side' : 'Classic' }}, {{ booking.bottomCoverage === 'cheeky' ? 'Cheeky' : 'Bikini' }} coverage, size {{ booking.bottomSize }} — {{ booking.bottomFabricName }}</dd></div>
            <div class="flex justify-between gap-3 border-t border-ink/10 pt-2"><dt class="text-ink/45">Amount paid</dt><dd class="font-semibold text-ink">USD${{ (booking.chargedUsdCents / 100).toFixed(2) }}</dd></div>
            <div v-if="eventDateLabel" class="flex justify-between gap-3"><dt class="text-ink/45">Event date</dt><dd>{{ eventDateLabel }}</dd></div>
            <div v-if="venue" class="flex justify-between gap-3"><dt class="text-ink/45">Venue</dt><dd>{{ venue }}</dd></div>
          </dl>
        </div>

        <div class="mt-8 flex flex-wrap justify-center gap-3">
          <NuxtLink to="/" class="btn-primary">Back to home</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useBikiniMixCheckout } from '~/composables/useBikiniMixCheckout'

useHead({ title: 'Payment received — The Bikini Mixer' })

const route = useRoute()
const { readCheckoutId, clearCheckoutId } = useBikiniMixCheckout()

const bookingRef = computed(() => {
  const b = route.query.b
  return typeof b === 'string' && /^BKM-\d{6}$/.test(b) ? b : ''
})

const phase = ref('waiting') // 'waiting' | 'resolved' | 'timeout'
const confirmed = ref(false)
const booking = ref(null)
const eventName = ref('The Bikini Mixer')
const eventDateLabel = ref('')
const venue = ref('')

let timer
let attempts = 0

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso
  }
}

async function checkStatus() {
  const id = typeof route.query.checkout === 'string' ? route.query.checkout : readCheckoutId()
  if (!id) {
    phase.value = 'timeout'
    return
  }

  try {
    const { status } = await $fetch('/api/bikini-mix/checkout/status', { params: { checkout: id } })
    if (status === 'confirmed' || status === 'needs_review') {
      confirmed.value = status === 'confirmed'
      await loadConfirmation(id)
      phase.value = 'resolved'
      clearCheckoutId()
      return
    }
  } catch {
    /* transient — keep polling */
  }

  attempts += 1
  if (attempts < 8) {
    timer = setTimeout(checkStatus, 3000)
  } else {
    phase.value = 'timeout'
  }
}

async function loadConfirmation(id) {
  try {
    const res = await $fetch('/api/bikini-mix/checkout/confirmation', { params: { checkout: id } })
    if (res.found) {
      booking.value = res.booking
      eventName.value = res.event?.eventName || 'The Bikini Mixer'
      eventDateLabel.value = formatDate(res.event?.eventDate)
      venue.value = res.event?.venue || ''
    }
  } catch {
    /* booking summary is a nice-to-have on this page — the status itself already resolved */
  }
}

onMounted(() => {
  checkStatus()
})
onBeforeUnmount(() => clearTimeout(timer))
</script>
