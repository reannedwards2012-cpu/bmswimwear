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
  status: { type: String, default: 'draft' }
})

const LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired'
}
const STYLES = {
  draft: 'bg-ink/10 text-ink/60',
  sent: 'bg-blush/30 text-ink',
  accepted: 'bg-seafoam/50 text-ink',
  declined: 'bg-coral/15 text-coral',
  expired: 'bg-shell text-ink/40'
}

const label = computed(() => LABELS[props.status] || props.status)
const cls = computed(() => STYLES[props.status] || 'bg-shell text-ink/60')
</script>
