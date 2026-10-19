<template>
  <!-- Illustrated selection tile — renders a traced sketch piece (neutral
       ink tone, not the live fabric colour, since this is a style/coverage
       choice, not a colour choice) in a clean card with a visible selected
       state and a label underneath. Used for Bottom Style and Bottom
       Coverage (components/bikini-mix/ArtTile.vue), reusing the exact same
       traced artwork as the live preview — never a substitute illustration. -->
  <button
    type="button"
    class="group flex flex-1 flex-col items-center gap-2 rounded-3xl border-2 bg-cream px-3 py-3.5 transition-all sm:px-4 sm:py-4"
    :class="selected ? 'border-coral shadow-card' : 'border-ink/10 hover:border-ink/25'"
    :aria-pressed="selected"
    @click="$emit('select')"
  >
    <span class="grid w-full place-items-center">
      <svg :width="width" :height="height" :viewBox="`0 0 ${piece.w} ${piece.h}`">
        <g :transform="piece.transform" fill="#5A4035" stroke="none">
          <path :d="piece.d" />
        </g>
      </svg>
    </span>
    <span class="flex items-center gap-1.5 text-sm font-semibold" :class="selected ? 'text-coral' : 'text-ink/70'">
      <svg v-if="selected" viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.4">
        <path d="m5 13 4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      {{ label }}
    </span>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { BIKINI_ART } from '~/data/bikiniMixArt.js'

const props = defineProps({
  artKey: { type: String, required: true }, // a key in BIKINI_ART
  label: { type: String, required: true },
  selected: { type: Boolean, default: false },
  width: { type: Number, default: 96 }
})
defineEmits(['select'])

const piece = computed(() => BIKINI_ART[props.artKey])
const height = computed(() => Math.round((piece.value.h / piece.value.w) * props.width))
</script>
