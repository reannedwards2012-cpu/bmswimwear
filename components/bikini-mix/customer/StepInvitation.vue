<template>
  <div>
    <!-- typography-led intro — no photo hero -->
    <section class="relative overflow-hidden rounded-4xl bg-cream px-6 py-12 text-center shadow-card sm:px-10 sm:py-16">
      <div class="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <PalmShadow position="top-right" tone="dark" size="lg" />
        <PalmShadow position="bottom-left" tone="dark" size="md" flip />
      </div>

      <h1 class="mx-auto max-w-xl font-display text-4xl font-semibold leading-[1.05] text-ink sm:text-5xl lg:text-6xl">
        The <span class="fancy-accent">Bikini Mixer</span>
      </h1>
      <p class="mx-auto mt-4 max-w-md text-lg font-medium text-ink/70 sm:text-xl">
        Pick your pieces. Mix your colours. Make it yours.
      </p>

      <p class="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink/70 sm:text-lg">
        Come spend an afternoon creating your very own bikini with Bahama Mama. We'll handle the sewing — you get to
        have fun mixing colours, choosing straps, adding beads, charms and all the little extras that make it yours.
      </p>

      <!-- event details — part of the invitation, not a separate section -->
      <div class="mx-auto mt-8 flex max-w-lg flex-wrap items-center justify-center gap-x-6 gap-y-3 border-y border-ink/10 py-6 text-sm text-ink/75 sm:text-base">
        <span class="inline-flex items-center gap-2"><span aria-hidden="true">📅</span> {{ formattedDate }}</span>
        <span class="inline-flex items-center gap-2"><span aria-hidden="true">📍</span> {{ venue || 'Venue TBA' }}</span>
        <span class="inline-flex items-center gap-2"><span aria-hidden="true">💸</span> Starting at {{ startingAtLabel }}</span>
        <span class="inline-flex items-center gap-2"><span aria-hidden="true">✨</span> Very limited spots available</span>
      </div>
      <p v-if="bookingDeadline" class="mt-3 text-center text-xs text-ink/45">
        Bookings close {{ formattedDeadline }}, or sooner if we fill up.
      </p>

      <div class="mt-8 flex justify-center">
        <button v-if="isBookingsOpen" type="button" class="btn-primary px-10 py-4 text-base shadow-soft" @click="$emit('continue')">
          Choose Your Base Colours
        </button>
        <div v-else class="max-w-sm rounded-3xl bg-shell/70 px-6 py-5 text-center">
          <p class="text-sm font-semibold text-ink">Bookings aren't open just yet</p>
          <p class="mt-1 text-xs text-ink/55">Check back soon, or follow along for the announcement.</p>
        </div>
      </div>
    </section>

    <!-- promo video — supporting, not dominant; omitted entirely until a real clip is uploaded -->
    <section v-if="promoVideoUrl" class="mx-auto mt-10 max-w-md">
      <p class="text-center text-xs font-semibold uppercase tracking-widest2 text-ink/40">See it in action</p>
      <div class="relative mt-3 aspect-video overflow-hidden rounded-3xl bg-shell shadow-card">
        <video :src="promoVideoUrl" controls class="h-full w-full object-cover" />
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatMoney } from '~/utils/money'

const props = defineProps({
  eventName: String,
  eventDate: String,
  eventDateIsTentative: Boolean,
  venue: String,
  venueIsConfirmed: Boolean,
  bookingDeadline: String,
  isBookingsOpen: Boolean,
  promoVideoUrl: String,
  classicMixPriceXcdCents: Number,
  theWorksPriceXcdCents: Number
})
defineEmits(['continue'])

function formatDate(iso) {
  if (!iso) return 'Date TBA'
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso
  }
}
const formattedDate = computed(() => formatDate(props.eventDate))
const formattedDeadline = computed(() => formatDate(props.bookingDeadline))

const startingAtLabel = computed(() => {
  const prices = [props.classicMixPriceXcdCents, props.theWorksPriceXcdCents].filter((p) => typeof p === 'number')
  if (!prices.length) return '—'
  return formatMoney(Math.min(...prices), 'XCD')
})
</script>
