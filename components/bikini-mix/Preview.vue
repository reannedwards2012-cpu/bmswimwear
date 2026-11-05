<template>
  <div
    class="relative flex w-full flex-col items-center gap-4 bg-cream/70"
    :class="compact ? 'rounded-3xl p-4' : 'rounded-4xl p-6 shadow-card sm:p-9'"
  >
    <button
      v-if="showFlip"
      type="button"
      class="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-widest2 text-ink/60 shadow-card transition-colors hover:text-coral"
      @click="view = view === 'front' ? 'back' : 'front'"
    >
      <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.2">
        <path d="M4 4v5h5M20 20v-5h-5M4.5 9A8 8 0 0 1 19.8 9M19.5 15a8 8 0 0 1-15.3 0" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      {{ view === 'front' ? 'See the back' : 'See the front' }}
    </button>

    <div class="flex flex-col items-center gap-5" :style="{ width: bottomWidth + 'px' }">
      <OnePiece
        v-if="garmentType === 'onepiece'"
        :colour="onepieceColour"
        :image-url="onepieceImageUrl"
        :active="activeComponent === 'onepiece'"
        :width="bottomWidth"
        :view="view"
        :coverage="onepieceCoverage"
        @select="$emit('select-component', 'onepiece')"
      />
      <template v-else>
        <TopTriangle
          :left-colour="leftColour"
          :right-colour="rightColour"
          :left-image-url="leftImageUrl"
          :right-image-url="rightImageUrl"
          :active="activeComponent === 'left' || activeComponent === 'right' ? activeComponent : null"
          :group-width="topGroupWidth"
          :view="view"
          @select="(side) => $emit('select-component', side)"
        />

        <component
          :is="bottomStyle === 'tie-side' ? BottomTieSide : BottomClassic"
          :colour="bottomColour"
          :image-url="bottomImageUrl"
          :active="activeComponent === 'bottom'"
          :width="bottomWidth"
          :view="view"
          :coverage="bottomCoverage"
          :scrunch="bottomScrunch"
          @select="$emit('select-component', 'bottom')"
        />
      </template>
    </div>

    <p v-if="showHint" class="text-center text-[0.65rem] leading-relaxed text-ink/35">
      Tap a piece to change its colour · screen colours may differ slightly from actual fabrics
    </p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import TopTriangle from './TopTriangle.vue'
import BottomTieSide from './BottomTieSide.vue'
import BottomClassic from './BottomClassic.vue'
import OnePiece from './OnePiece.vue'

const props = defineProps({
  garmentType: { type: String, default: 'bikini' }, // 'bikini' | 'onepiece'
  // bikini:
  leftColour: { type: String, default: '#c9a98a' },
  rightColour: { type: String, default: '#c9a98a' },
  leftImageUrl: { type: String, default: null },
  rightImageUrl: { type: String, default: null },
  bottomStyle: { type: String, default: 'tie-side' }, // 'tie-side' | 'classic'
  bottomColour: { type: String, default: '#c9a98a' },
  bottomImageUrl: { type: String, default: null },
  bottomCoverage: { type: String, default: 'bikini' }, // 'bikini' | 'cheeky'
  bottomScrunch: { type: Boolean, default: false },
  // onepiece:
  onepieceColour: { type: String, default: '#c9a98a' },
  onepieceImageUrl: { type: String, default: null },
  onepieceCoverage: { type: String, default: 'bikini' },
  activeComponent: { type: String, default: null }, // 'left' | 'right' | 'bottom' | 'onepiece' | null
  previewWidth: { type: Number, default: 280 },
  showHint: { type: Boolean, default: true },
  showFlip: { type: Boolean, default: true },
  // true = minimal inline backdrop (Review & Pay: no shadow/card chrome,
  // just enough cream behind the illustration for light fabrics to stay
  // visible). false = the full preview card (Builder).
  compact: { type: Boolean, default: false }
})
defineEmits(['select-component'])

// Front/back toggle — local to the preview, independent of which piece is
// selected for colour-editing. Defaults to front for every garment type.
const view = ref('front')

// The bottom (or one-piece) is the widest element — everything else
// balances against it. The top's combined width is tuned to read as a
// proportioned set while each triangle keeps its own traced aspect ratio.
const bottomWidth = computed(() => Math.round(props.previewWidth * 0.86))
const topGroupWidth = computed(() => Math.round(bottomWidth.value * 0.82))
</script>
