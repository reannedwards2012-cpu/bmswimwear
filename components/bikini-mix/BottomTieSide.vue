<template>
  <!-- Tie-side bottom, front view only — the main preview no longer shows a
       back view (coverage is now illustrated separately via ArtTile in the
       Bottom Coverage section). The front is the same piece regardless of
       coverage; bows/strings are part of this same traced path, always
       visible. Sized by WIDTH so the parent can balance it against the top. -->
  <button
    type="button"
    class="piece-btn grid place-items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral/70"
    :class="{ 'is-active': active }"
    :aria-pressed="active"
    aria-label="Edit bottom colour"
    @click="$emit('select')"
  >
    <svg :width="width" :height="height" :viewBox="`0 0 ${piece.w} ${piece.h}`">
      <defs>
        <clipPath :id="clipId">
          <path :d="piece.d" :transform="piece.transform" />
        </clipPath>
      </defs>
      <g v-if="!imageUrl" :transform="piece.transform" :fill="colour" stroke="none">
        <path :d="piece.d" />
      </g>
      <image
        v-else
        :href="imageUrl"
        x="0"
        y="0"
        :width="piece.w"
        :height="piece.h"
        preserveAspectRatio="xMidYMid slice"
        :clip-path="`url(#${clipId})`"
      />
      <g :transform="piece.transform" fill="none" stroke="rgba(28,28,28,0.14)" stroke-width="12">
        <path :d="piece.d" />
      </g>
    </svg>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { BIKINI_ART } from '~/data/bikiniMixArt.js'

const props = defineProps({
  colour: { type: String, required: true },
  imageUrl: { type: String, default: null },
  active: { type: Boolean, default: false },
  width: { type: Number, default: 220 }
})
defineEmits(['select'])

const piece = BIKINI_ART.tie_front
const clipId = `bm-tie-clip-${Math.random().toString(36).slice(2)}`
const height = computed(() => Math.round((piece.h / piece.w) * props.width))
</script>

<style scoped>
.piece-btn {
  border-radius: 0.75rem;
  transition: filter 200ms ease;
  filter: drop-shadow(0 0 0 rgba(230, 107, 69, 0));
}
.piece-btn:hover {
  filter: drop-shadow(0 0 4px rgba(90, 64, 53, 0.22));
}
.piece-btn.is-active {
  filter: drop-shadow(0 0 3px rgba(230, 107, 69, 0.9)) drop-shadow(0 0 7px rgba(230, 107, 69, 0.45));
}
</style>

