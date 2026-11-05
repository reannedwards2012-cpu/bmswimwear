<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center sm:p-6"
      @click.self="close"
    >
      <div class="max-h-[88vh] w-full overflow-y-auto rounded-t-4xl bg-cream p-6 shadow-card sm:max-w-2xl sm:rounded-4xl sm:p-8">
        <div class="flex items-center justify-between">
          <h2 class="font-display text-lg font-semibold text-ink">See What You Can Customize</h2>
          <button type="button" class="text-ink/40 transition-colors hover:text-ink" aria-label="Close" @click="close">✕</button>
        </div>
        <p class="mt-2 text-xs text-ink/55">
          A look at the straps, beads, charms and finishing touches available at the event — browsing here never
          changes or erases your current selections.
        </p>

        <p v-if="pending" class="mt-8 text-center text-sm text-ink/50">Loading…</p>
        <div v-else-if="error" class="mt-8 text-center">
          <p class="text-sm text-coral">Couldn't load the gallery right now.</p>
          <button type="button" class="btn-outline mt-3 px-4 py-1.5 text-xs" @click="refresh()">Try again</button>
        </div>
        <p v-else-if="!images.length" class="mt-8 text-center text-sm text-ink/50">Photos are coming soon — check back closer to the event.</p>

        <div v-else class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div v-for="img in images" :key="img.id" class="overflow-hidden rounded-2xl border border-ink/10 bg-shell/40">
            <div class="aspect-square w-full bg-cover bg-center" :style="{ backgroundImage: `url(${img.imageUrl})` }" />
            <div class="flex items-center justify-between gap-2 px-2.5 py-2">
              <span class="truncate text-[0.65rem] text-ink/55">{{ img.caption || CATEGORY_LABELS[img.category] }}</span>
              <span
                class="shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest2"
                :class="img.includedInTicket ? 'bg-seafoam/50 text-ink' : 'bg-blush/30 text-ink/70'"
              >
                {{ img.includedInTicket ? 'Included' : 'Add at event' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // Internal-preview-only escape hatch: when supplied, these images are
  // used directly instead of fetching /api/bikini-mix/gallery — lets
  // pages/dev/swimsuit-mixer-preview.vue review this overlay with mock
  // content while the real schema isn't live yet. Never set by the real
  // customer-facing page.
  previewImages: { type: Array, default: null }
})
const emit = defineEmits(['update:modelValue'])

const CATEGORY_LABELS = {
  strap: 'Strap',
  bead: 'Bead',
  charm: 'Charm',
  rhinestone: 'Rhinestone',
  iron_on: 'Iron-on design',
  finished_swimsuit: 'Finished swimsuit'
}

const isPreview = props.previewImages != null
const live = isPreview ? null : await useBikiniMixGallery()
const images = computed(() => (isPreview ? props.previewImages : live.images.value))
const pending = isPreview ? ref(false) : live.pending
const error = isPreview ? ref(null) : live.error
const refresh = isPreview ? () => {} : live.refresh

// Lazy-load the first time the overlay opens — never on initial page load,
// since most visitors never open it. Skipped entirely in preview mode.
let loaded = false
watch(
  () => props.modelValue,
  (open) => {
    if (open && !loaded && !isPreview) {
      loaded = true
      refresh()
    }
  }
)

function close() {
  emit('update:modelValue', false)
}
</script>
