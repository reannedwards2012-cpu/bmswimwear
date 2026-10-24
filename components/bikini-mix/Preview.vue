<template>
  <div
    class="relative flex w-full flex-col items-center gap-4 bg-cream/70"
    :class="compact ? 'rounded-3xl p-4' : 'rounded-4xl p-6 shadow-card sm:p-9'"
  >
    <div class="flex flex-col items-center gap-5" :style="{ width: bottomWidth + 'px' }">
      <TopTriangle
        :left-colour="leftColour"
        :right-colour="rightColour"
        :left-image-url="leftImageUrl"
        :right-image-url="rightImageUrl"
        :active="activeComponent === 'left' || activeComponent === 'right' ? activeComponent : null"
        :group-width="topGroupWidth"
        @select="(side) => $emit('select-component', side)"
      />

      <component
        :is="bottomStyle === 'tie-side' ? BottomTieSide : BottomClassic"
        :colour="bottomColour"
        :image-url="bottomImageUrl"
        :active="activeComponent === 'bottom'"
        :width="bottomWidth"
        @select="$emit('select-component', 'bottom')"
      />
    </div>

    <p v-if="showHint" class="text-center text-[0.65rem] leading-relaxed text-ink/35">
      Tap a piece to change its colour · screen colours may differ slightly from actual fabrics
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import TopTriangle from './TopTriangle.vue'
import BottomTieSide from './BottomTieSide.vue'
import BottomClassic from './BottomClassic.vue'

const props = defineProps({
  leftColour: { type: String, required: true },
  rightColour: { type: String, required: true },
  leftImageUrl: { type: String, default: null },
  rightImageUrl: { type: String, default: null },
  bottomStyle: { type: String, required: true }, // 'tie-side' | 'classic'
  bottomColour: { type: String, required: true },
  bottomImageUrl: { type: String, default: null },
  activeComponent: { type: String, default: null }, // 'left' | 'right' | 'bottom' | null
  previewWidth: { type: Number, default: 280 },
  showHint: { type: Boolean, default: true },
  // true = minimal inline backdrop (Review & Pay: no shadow/card chrome,
  // just enough cream behind the illustration for light fabrics to stay
  // visible). false = the full preview card (Builder).
  compact: { type: Boolean, default: false }
})
defineEmits(['select-component'])

// The bottom is the widest element — everything else balances against it.
// The top's combined width is tuned to read as a proportioned set (not the
// previous ~50%-of-bottom mismatch) while each triangle keeps its own
// traced aspect ratio — this only changes the shared target width, never
// the shape.
const bottomWidth = computed(() => Math.round(props.previewWidth * 0.86))
const topGroupWidth = computed(() => Math.round(bottomWidth.value * 0.82))
</script>
