<template>
  <section class="mx-auto mt-10 max-w-3xl">
    <div class="text-center">
      <p class="text-[0.65rem] font-semibold uppercase tracking-widest2 text-mixer-coral">Customize Your Way</p>
      <h2 class="mt-1.5 font-display text-2xl font-semibold text-mixer-ink sm:text-3xl">Get Inspired</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-mixer-ink/55">
        Straps, beads, charms and finishing touches from past Swimsuit Mixer events — browsing here never changes
        your selections.
      </p>
    </div>

    <p v-if="pending" class="mt-8 text-center text-sm text-mixer-ink/45">Loading…</p>
    <div v-else-if="error" class="mt-8 text-center">
      <p class="text-sm text-mixer-coral">Couldn't load the gallery right now.</p>
      <button type="button" class="rounded-full border border-mixer-ink/20 px-4 py-1.5 text-xs font-semibold text-mixer-ink/70 hover:border-mixer-coral hover:text-mixer-coral" @click="$emit('retry')">
        Try again
      </button>
    </div>
    <p v-else-if="!images.length" class="mt-8 text-center text-sm text-mixer-ink/45">
      Photos are coming soon — check back closer to the event.
    </p>

    <template v-else>
      <div class="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
        <button
          v-for="(img, i) in visibleImages"
          :key="img.id"
          type="button"
          class="group relative aspect-square overflow-hidden rounded-3xl bg-mixer-blush/30 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-mixer-coral"
          :aria-label="`View ${img.caption || 'gallery photo'} larger`"
          @click="$emit('open', i)"
        >
          <img :src="img.imageUrl" :alt="img.caption || ''" class="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
          <span
            class="absolute bottom-2 right-2 rounded-full px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-widest2 shadow-sm"
            :class="img.includedInTicket ? 'bg-mixer-ivory/90 text-mixer-ink' : 'bg-mixer-ink/70 text-mixer-ivory'"
          >
            {{ img.includedInTicket ? 'Included' : 'Add at event' }}
          </span>
        </button>
      </div>

      <div v-if="hasMore" class="mt-7 flex justify-center">
        <button
          type="button"
          class="rounded-full border border-mixer-ink/20 px-6 py-2 text-xs font-semibold text-mixer-ink/70 transition hover:border-mixer-coral hover:text-mixer-coral"
          @click="showAll = true"
        >
          View more photos ({{ images.length - visibleCount }} more)
        </button>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  images: { type: Array, default: () => [] },
  pending: { type: Boolean, default: false },
  error: { type: [Boolean, Object, Error], default: null }
})
defineEmits(['open', 'retry'])

const INITIAL_COUNT = 8
const showAll = ref(false)
const visibleCount = computed(() => (showAll.value ? props.images.length : Math.min(INITIAL_COUNT, props.images.length)))
// visibleImages is always a prefix starting at index 0, so each item's
// v-for index below matches its real index in the full `images` array —
// the index GalleryLightbox needs to open at the right photo.
const visibleImages = computed(() => props.images.slice(0, visibleCount.value))
const hasMore = computed(() => !showAll.value && props.images.length > visibleCount.value)

// A fresh, shorter image list (e.g. after a retry) shouldn't leave "View
// more" permanently expanded from a previous, longer list.
watch(
  () => props.images,
  () => { showAll.value = false }
)
</script>
