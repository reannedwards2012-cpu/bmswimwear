<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest2"
    :class="cls"
  >
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, default: 'new' }
})

const LABELS = {
  new: 'New',
  open: 'Open',
  responded: 'Responded',
  closed: 'Closed'
}
const STYLES = {
  new: 'bg-coral/15 text-coral',
  open: 'bg-blush/30 text-ink',
  responded: 'bg-seafoam/50 text-ink',
  closed: 'bg-ink/10 text-ink/60'
}

const label = computed(() => LABELS[props.status] || props.status)
const cls = computed(() => STYLES[props.status] || 'bg-shell text-ink/60')
</script>
