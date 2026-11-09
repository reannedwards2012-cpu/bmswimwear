<template>
  <div>
    <!-- typography-led intro — airy ivory/blush, no busy decoration -->
    <section class="relative overflow-hidden rounded-4xl bg-cream px-6 py-12 text-center shadow-card sm:px-10 sm:py-16 lg:px-14">
      <!-- one very subtle blush wash — not a pattern, not a graphic -->
      <div
        class="pointer-events-none absolute -right-24 -top-28 -z-10 h-72 w-72 rounded-full bg-mixer-blush opacity-60 blur-3xl"
        aria-hidden="true"
      />
      <div
        class="pointer-events-none absolute -bottom-24 -left-20 -z-10 h-64 w-64 rounded-full bg-mixer-blush opacity-40 blur-3xl"
        aria-hidden="true"
      />

      <!-- 1. event heading -->
      <h1 class="font-display text-3xl font-semibold leading-[1.1] text-mixer-ink sm:text-4xl lg:text-5xl">
        The Swimsuit <span class="fancy-accent">Mixer</span>
      </h1>

      <!-- 2. introductory video -->
      <div class="mx-auto mt-6 max-w-xl">
        <div class="relative aspect-video overflow-hidden rounded-3xl bg-mixer-blush/30 shadow-card">
          <video
            v-if="promoVideoUrl"
            ref="videoEl"
            :src="promoVideoUrl"
            :poster="promoVideoThumbnailUrl || undefined"
            controls
            playsinline
            class="h-full w-full object-cover"
            @play="videoStarted = true"
          />
          <button
            v-if="showPlayOverlay"
            type="button"
            class="absolute inset-0 flex items-center justify-center bg-ink/10 transition-colors hover:bg-ink/20"
            aria-label="Play video"
            @click="playVideo"
          >
            <span
              class="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-mixer-coral shadow-soft transition duration-200 hover:scale-105"
              aria-hidden="true"
            >
              <svg class="ml-1 h-6 w-6" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2.8c0-.7.76-1.14 1.37-.77l8.2 4.95a.9.9 0 0 1 0 1.54l-8.2 4.95A.9.9 0 0 1 4 12.5V2.8Z" />
              </svg>
            </span>
          </button>
          <div v-if="!promoVideoUrl" class="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-mixer-ink/45">
            <span class="flex h-12 w-12 items-center justify-center rounded-full bg-mixer-coral/15 text-mixer-coral" aria-hidden="true">
              <svg class="ml-0.5 h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2.8c0-.7.76-1.14 1.37-.77l8.2 4.95a.9.9 0 0 1 0 1.54l-8.2 4.95A.9.9 0 0 1 4 12.5V2.8Z" />
              </svg>
            </span>
            <p class="text-xs font-semibold uppercase tracking-widest2">Video coming soon</p>
            <p class="max-w-xs text-[0.7rem] leading-relaxed text-mixer-ink/35">
              A quick look at choosing your silhouette, style and coverage, and personalizing it with beads, charms,
              rhinestones and decals.
            </p>
          </div>
        </div>
      </div>

      <!-- 4. date, time & venue -->
      <div class="mx-auto mt-7 flex max-w-sm flex-col items-start gap-2.5 text-left">
        <div class="flex items-center gap-2.5 text-sm text-mixer-ink/75">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mixer-blush/70 text-xs" aria-hidden="true">📅</span>
          <span><span class="font-semibold text-mixer-ink">Date</span> · {{ formattedDate }}</span>
        </div>
        <div class="flex items-center gap-2.5 text-sm text-mixer-ink/75">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mixer-blush/70 text-xs" aria-hidden="true">🕙</span>
          <span><span class="font-semibold text-mixer-ink">Time</span> · {{ eventTime }}</span>
        </div>
        <div class="flex items-center gap-2.5 text-sm text-mixer-ink/75">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mixer-blush/70 text-xs" aria-hidden="true">📍</span>
          <span><span class="font-semibold text-mixer-ink">Venue</span> · {{ venue || 'Venue TBA' }}</span>
        </div>
      </div>
      <p v-if="bookingDeadline" class="mx-auto mt-3 max-w-sm text-left text-xs text-mixer-ink/40">
        Bookings close {{ formattedDeadline }}, or sooner if we fill up.
      </p>

      <!-- 5. ticket price / early bird — one clean, prominent block -->
      <div class="mx-auto mt-7 max-w-sm">
        <div v-if="earlyBirdAvailable" class="rounded-3xl bg-mixer-blush/50 px-6 py-4 text-center">
          <p class="text-[0.65rem] font-semibold uppercase tracking-widest2 text-mixer-coral">Early Bird</p>
          <p class="mt-1.5 text-sm text-mixer-ink/40 line-through">{{ formatMoney(regularPriceXcdCents, 'XCD') }}</p>
          <p class="font-display text-2xl font-semibold text-mixer-ink">{{ formatMoney(earlyBirdPriceXcdCents, 'XCD') }}</p>
          <p class="mt-1.5 text-xs text-mixer-ink/50">{{ earlyBirdSpotsLabel }}</p>
        </div>
        <div v-else class="rounded-3xl bg-mixer-blush/30 px-6 py-4 text-center">
          <p class="text-[0.65rem] font-semibold uppercase tracking-widest2 text-mixer-ink/45">Ticket</p>
          <p class="mt-1 font-display text-xl font-semibold text-mixer-ink">{{ formatMoney(regularPriceXcdCents, 'XCD') }}</p>
        </div>
      </div>

      <!-- 6. what's included — collapsed accordion, full list always reachable -->
      <div v-if="ticketInclusions.length" class="mx-auto mt-5 max-w-lg overflow-hidden rounded-3xl bg-mixer-blush/25 text-left">
        <h2>
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 px-5 py-3.5"
            :aria-expanded="inclusionsOpen"
            aria-controls="inclusions-panel"
            @click="inclusionsOpen = !inclusionsOpen"
          >
            <span>
              <span class="block text-sm font-semibold text-mixer-ink">What's Included</span>
              <span class="block text-xs text-mixer-ink/50">Everything that comes with your ticket</span>
            </span>
            <svg
              class="h-3.5 w-3.5 shrink-0 text-mixer-ink/50 transition-transform duration-200"
              :class="inclusionsOpen ? 'rotate-180' : ''"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M3.5 6L8 10.5L12.5 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </h2>

        <div id="inclusions-panel" class="accordion-panel" :class="{ 'is-open': inclusionsOpen }" role="region" aria-label="What's included" :aria-hidden="!inclusionsOpen">
          <div class="accordion-inner">
            <div class="divide-y divide-mixer-ink/10 px-5 pb-4">
              <div v-for="group in categorizedInclusions" :key="group.name" class="py-2.5 first:pt-0 last:pb-0">
                <p class="text-[0.62rem] font-semibold uppercase tracking-widest2 text-mixer-coral">{{ group.name }}</p>
                <ul class="mt-1.5 space-y-1">
                  <li v-for="item in group.items" :key="item" class="flex items-start gap-1.5 text-xs text-mixer-ink/70">
                    <span class="mt-0.5 shrink-0 text-mixer-coral" aria-hidden="true">✓</span>
                    {{ item }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 7. continue/customize button -->
      <div class="mt-8 flex flex-col items-center gap-3">
        <button v-if="isBookingsOpen" type="button" class="rounded-full bg-mixer-coral px-10 py-4 text-base font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-mixer-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-mixer-coral" @click="$emit('continue')">
          Build Your Swimsuit
        </button>
        <div v-else class="max-w-sm rounded-3xl bg-mixer-blush/30 px-6 py-5 text-center">
          <p class="text-sm font-semibold text-mixer-ink">Bookings aren't open just yet</p>
          <p class="mt-1 text-xs text-mixer-ink/55">Check back soon, or follow along for the announcement.</p>
        </div>
      </div>
    </section>

    <BikiniMixCustomerGalleryGrid
      :images="galleryImages"
      :pending="galleryPending"
      :error="galleryError"
      @open="(i) => $emit('open-gallery-at', i)"
      @retry="$emit('retry-gallery')"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { formatMoney } from '~/utils/money'

const props = defineProps({
  eventName: String,
  eventDate: String,
  eventDateIsTentative: Boolean,
  // Not yet part of the data model (no DB column / admin field) — a static
  // display default until the client asks for this to be admin-editable.
  eventTime: { type: String, default: '10:00 AM – 2:00 PM' },
  venue: String,
  venueIsConfirmed: Boolean,
  bookingDeadline: String,
  isBookingsOpen: Boolean,
  promoVideoUrl: String,
  promoVideoThumbnailUrl: String,
  regularPriceXcdCents: Number,
  earlyBirdPriceXcdCents: Number,
  earlyBirdSlots: Number,
  // How many Early Bird slots are still unclaimed right now — distinct from
  // earlyBirdSlots (the fixed total, e.g. 3). Falls back to earlyBirdSlots
  // if a caller doesn't pass one, so this stays backward-compatible.
  earlyBirdRemaining: { type: Number, default: null },
  earlyBirdAvailable: Boolean,
  ticketInclusions: { type: Array, default: () => [] },
  galleryImages: { type: Array, default: () => [] },
  galleryPending: { type: Boolean, default: false },
  galleryError: { type: [Boolean, Object, Error], default: null }
})
defineEmits(['continue', 'open-gallery-at', 'retry-gallery'])

const videoEl = ref(null)
const videoStarted = ref(false)
const showPlayOverlay = computed(() => Boolean(props.promoVideoUrl) && Boolean(props.promoVideoThumbnailUrl) && !videoStarted.value)
function playVideo() {
  videoEl.value?.play()
}

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

const earlyBirdSpotsLabel = computed(() => {
  const n = props.earlyBirdRemaining ?? props.earlyBirdSlots ?? 0
  return `Only ${n} Early Bird Spot${n === 1 ? '' : 's'} Left`
})

const inclusionsOpen = ref(false)

// Groups the (still flat, still admin-editable-as-a-plain-list)
// ticketInclusions array into display categories, purely for presentation —
// the underlying data/admin editor is untouched. Anything not in this
// known-text map (e.g. an item the admin adds or rewords later) still shows
// up, under "More", so the full list is never silently dropped.
const CATEGORY_MAP = {
  'Your choice of bikini or one-piece swimsuit': 'Your Swimsuit',
  'Straps included': 'Your Swimsuit',
  Straps: 'Your Swimsuit',
  'Up to 6 premium beads': 'Your Customizations',
  'Up to 4 pony beads': 'Your Customizations',
  '1 premium charm': 'Your Customizations',
  '2 basic charms': 'Your Customizations',
  '1 iron-on decal': 'Your Customizations',
  'Up to 20 rhinestones': 'Your Customizations',
  Wine: 'Sips & Bites',
  'Finger foods': 'Sips & Bites'
}
const CATEGORY_ORDER = ['Your Swimsuit', 'Your Customizations', 'Sips & Bites', 'More']
const categorizedInclusions = computed(() => {
  const buckets = { 'Your Swimsuit': [], 'Your Customizations': [], 'Sips & Bites': [], More: [] }
  for (const item of props.ticketInclusions) {
    buckets[CATEGORY_MAP[item] || 'More'].push(item)
  }
  return CATEGORY_ORDER.map((name) => ({ name, items: buckets[name] })).filter((g) => g.items.length)
})
</script>

<style scoped>
/* grid-template-rows 0fr→1fr trick: animates height without JS measuring,
   and respects prefers-reduced-motion automatically via the site-wide
   transition-duration override in assets/css/tailwind.css. */
.accordion-panel {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 280ms ease;
}
.accordion-panel.is-open {
  grid-template-rows: 1fr;
}
.accordion-inner {
  overflow: hidden;
}
</style>
