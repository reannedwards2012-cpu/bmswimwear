<template>
  <!-- Classic bottom, front view only — see BottomTieSide.vue's header
       comment; the same reasoning applies here. -->
  <button
    type="button"
    class="piece-btn grid place-items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral/70"
    :class="{ 'is-active': active }"
    :aria-pressed="active"
    aria-label="Edit bottom colour"
    @click="$emit('select')"
  >
    <svg :width="width" :height="height" :viewBox="`0 0 ${piece.w} ${piece.h}`">
      <g :transform="piece.transform" :fill="colour" stroke="none">
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
  active: { type: Boolean, default: false },
  width: { type: Number, default: 220 }
})
defineEmits(['select'])

const piece = BIKINI_ART.classic_front
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

