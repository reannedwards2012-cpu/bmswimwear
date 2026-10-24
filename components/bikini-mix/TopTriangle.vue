<template>
  <!-- Two independently-recolourable, independently-clickable triangle
       paths, traced from the original sketch. Sized by combined WIDTH (not
       height) so the parent can balance the top against the bottom's own
       width — each half still renders at its own traced aspect ratio,
       never stretched. -->
  <div class="flex items-end justify-center" :style="{ gap: gapPx + 'px' }">
    <button
      v-for="side in ['left', 'right']"
      :key="side"
      type="button"
      class="piece-btn grid place-items-end focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral/70"
      :class="{ 'is-active': active === side }"
      :aria-pressed="active === side"
      :aria-label="side === 'left' ? 'Edit left triangle colour' : 'Edit right triangle colour'"
      @click="$emit('select', side)"
    >
      <svg :width="perWidth" :height="perHeight" :viewBox="`0 0 ${art[side].w} ${art[side].h}`">
        <defs>
          <clipPath :id="`${clipIdBase}-${side}`">
            <path :d="art[side].d" :transform="art[side].transform" />
          </clipPath>
        </defs>
        <g v-if="!(side === 'left' ? leftImageUrl : rightImageUrl)" :transform="art[side].transform" :fill="side === 'left' ? leftColour : rightColour" stroke="none">
          <path :d="art[side].d" />
        </g>
        <image
          v-else
          :href="side === 'left' ? leftImageUrl : rightImageUrl"
          x="0"
          y="0"
          :width="art[side].w"
          :height="art[side].h"
          preserveAspectRatio="xMidYMid slice"
          :clip-path="`url(#${clipIdBase}-${side})`"
        />
        <!-- subtle outline so light/white fabrics stay visible against the preview background -->
        <g :transform="art[side].transform" fill="none" stroke="rgba(28,28,28,0.14)" stroke-width="12">
          <path :d="art[side].d" />
        </g>
      </svg>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { BIKINI_ART } from '~/data/bikiniMixArt.js'

const props = defineProps({
  leftColour: { type: String, required: true },
  rightColour: { type: String, required: true },
  leftImageUrl: { type: String, default: null },
  rightImageUrl: { type: String, default: null },
  active: { type: String, default: null }, // 'left' | 'right' | null
  groupWidth: { type: Number, default: 220 } // combined width of both triangles + gap
})
defineEmits(['select'])

const art = { left: BIKINI_ART.top_left, right: BIKINI_ART.top_right }
const clipIdBase = `bm-top-clip-${Math.random().toString(36).slice(2)}`

const gapPx = computed(() => Math.round(props.groupWidth * 0.045))
const perWidth = computed(() => Math.round((props.groupWidth - gapPx.value) / 2))
// both halves share essentially the same traced aspect ratio — average the two
const aspect = computed(() => (art.left.w / art.left.h + art.right.w / art.right.h) / 2)
const perHeight = computed(() => Math.round(perWidth.value / aspect.value))
</script>

<style scoped>
/* Selection highlight follows the actual traced silhouette (via
   drop-shadow, which hugs the rendered shape's alpha — including the thin
   strings — unlike a box-shadow/ring, which only ever draws a rectangle). */
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

