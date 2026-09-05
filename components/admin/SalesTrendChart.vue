<template>
  <div>
    <svg
      viewBox="0 0 600 200"
      preserveAspectRatio="none"
      class="block h-40 w-full sm:h-48"
      role="img"
      :aria-label="`Sales trend: ${points.map((p) => `${p.label} ${money(p.salesUsdCents)}`).join(', ')}`"
    >
      <!-- baseline -->
      <line x1="0" :y1="baselineY" x2="600" :y2="baselineY" stroke="currentColor" class="text-ink/10" stroke-width="1" />
      <!-- soft fill under the line -->
      <path :d="areaPath" fill="currentColor" class="text-coral/10" stroke="none" />
      <!-- trend line -->
      <path :d="linePath" fill="none" stroke="currentColor" class="text-coral" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
      <!-- data points -->
      <circle v-for="(pt, i) in coords" :key="i" :cx="pt.x" :cy="pt.y" r="3" fill="#FFFDFA" stroke="currentColor" class="text-coral" stroke-width="2">
        <title>{{ points[i].label }}: {{ money(points[i].salesUsdCents) }}</title>
      </circle>
    </svg>

    <div class="mt-2 flex text-[0.65rem] text-ink/40">
      <span
        v-for="(pt, i) in points"
        :key="i"
        class="flex-1 text-center"
        :class="i === 0 ? 'text-left' : i === points.length - 1 ? 'text-right' : ''"
      >
        {{ showLabel(i) ? pt.label : '' }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatUsd } from '~/utils/money'

const props = defineProps({
  // [{ label, salesUsdCents }]
  points: { type: Array, required: true }
})

const money = (cents) => formatUsd(cents / 100)

const PAD_X = 12
const PAD_TOP = 12
const PAD_BOTTOM = 12
const W = 600
const H = 200
const baselineY = H - PAD_BOTTOM

const maxCents = computed(() => Math.max(1, ...props.points.map((p) => p.salesUsdCents)))

const coords = computed(() => {
  const n = props.points.length
  const innerW = W - PAD_X * 2
  const innerH = H - PAD_TOP - PAD_BOTTOM
  return props.points.map((p, i) => {
    const x = n <= 1 ? W / 2 : PAD_X + (i / (n - 1)) * innerW
    const y = PAD_TOP + innerH * (1 - p.salesUsdCents / maxCents.value)
    return { x, y }
  })
})

const linePath = computed(() =>
  coords.value.length ? coords.value.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x},${c.y}`).join(' ') : ''
)
const areaPath = computed(() => {
  if (!coords.value.length) return ''
  const first = coords.value[0]
  const last = coords.value[coords.value.length - 1]
  return `${linePath.value} L ${last.x},${baselineY} L ${first.x},${baselineY} Z`
})

// Dense trends (e.g. ~31 daily buckets for "This Month") thin their axis
// labels so they don't overlap on mobile — the line itself still plots
// every point, only the text labels beneath are skipped.
const labelStep = computed(() => Math.max(1, Math.ceil(props.points.length / 8)))
const showLabel = (i) => i === 0 || i === props.points.length - 1 || i % labelStep.value === 0
</script>
