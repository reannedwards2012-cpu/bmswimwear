<template>
  <!-- One-piece swimsuit — a single colourable/fabric zone, unlike the
       bikini's three independent pieces. Same clipPath + flat-fill-or-
       clipped-image pattern as TopTriangle/Bottom*.vue, with front/back
       views and an honest placeholder until real art is supplied (see
       data/bikiniMixArt.js). Straps (shoulder + side) are always black —
       only the body silhouette ever takes the selected fabric. -->
  <button
    type="button"
    class="piece-btn grid place-items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral/70"
    :class="{ 'is-active': active }"
    :aria-pressed="active"
    aria-label="Edit swimsuit colour"
    @click="$emit('select')"
  >
    <BikiniMixArtPlaceholder v-if="piece.missing" :width="width" :height="height" :colour="colour" />
    <svg v-else :width="width" :height="height" :viewBox="`0 0 ${piece.w} ${piece.h}`">
      <defs>
        <!-- clip-rule="evenodd" (not the default nonzero) — the body is two
             mirrored half-paths meeting at the hem; nonzero can cancel the
             overlap under a clip and lose the pattern image entirely. No
             stroke is ever drawn on this path (see data/bikiniMixArt.js's
             comment) — edge legibility for light fabrics comes from the
             drop-shadow below instead, since a path-geometry stroke on
             these two mirrored halves draws a visible centre seam. -->
        <clipPath :id="clipId">
          <path :d="piece.d" :transform="piece.transform" clip-rule="evenodd" />
        </clipPath>
      </defs>
      <!-- body: tinted to the selected fabric colour, or the selected pattern image clipped to the silhouette -->
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

      <!-- the teardrop keyhole — an open gap in the fabric, always white, never tinted -->
      <g v-if="piece.cutout" :transform="piece.transform" fill="#fff" stroke="none">
        <path :d="piece.cutout" />
      </g>
      <!-- straps (shoulder + side) — always black, independent of the selected body colour/pattern -->
      <g v-if="piece.straps" :transform="piece.transform" fill="#000" stroke="none">
        <path :d="piece.straps" />
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
  width: { type: Number, default: 220 },
  view: { type: String, default: 'front' }, // 'front' | 'back'
  coverage: { type: String, default: 'bikini' } // 'bikini' | 'cheeky' — back view only
})
defineEmits(['select'])

const piece = computed(() => {
  if (props.view !== 'back') return BIKINI_ART.one_piece_front
  return BIKINI_ART[props.coverage === 'cheeky' ? 'one_piece_back_cheeky' : 'one_piece_back_bikini']
})
const clipId = `bm-onepiece-clip-${Math.random().toString(36).slice(2)}`
const height = computed(() => (piece.value.missing ? props.width * 1.4 : Math.round((piece.value.h / piece.value.w) * props.width)))
</script>

<style scoped>
/* A permanent, subtle dark edge via drop-shadow (not an SVG stroke on the
   body path) — drop-shadow traces the rendered silhouette's alpha, so it
   keeps white/light fabrics visible against the preview background
   without ever being able to expose the body's internal mirrored-half
   seam the way a path-geometry stroke would. Layered with (not replacing)
   the existing hover/active selection glow below. */
.piece-btn {
  border-radius: 0.75rem;
  transition: filter 200ms ease;
  filter: drop-shadow(0 0 1px rgba(28, 28, 28, 0.35)) drop-shadow(0 0 0 rgba(230, 107, 69, 0));
}
.piece-btn:hover {
  filter: drop-shadow(0 0 1px rgba(28, 28, 28, 0.35)) drop-shadow(0 0 4px rgba(90, 64, 53, 0.22));
}
.piece-btn.is-active {
  filter: drop-shadow(0 0 1px rgba(28, 28, 28, 0.35)) drop-shadow(0 0 3px rgba(230, 107, 69, 0.9))
    drop-shadow(0 0 7px rgba(230, 107, 69, 0.45));
}
</style>
