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
  source: { type: String, default: 'website' }
})

const LABELS = {
  website: 'Website',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  in_person: 'In Person',
  other: 'Other'
}
const STYLES = {
  website: 'bg-ink/10 text-ink/60',
  instagram: 'bg-blush/30 text-ink',
  whatsapp: 'bg-seafoam/50 text-ink',
  in_person: 'bg-shell text-ink/70',
  other: 'bg-shell text-ink/50'
}

const label = computed(() => LABELS[props.source] || props.source)
const cls = computed(() => STYLES[props.source] || 'bg-shell text-ink/60')
</script>
