<template>
  <div class="rounded-4xl bg-cream p-6 shadow-card">
    <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/45">{{ label }}</p>
    <p class="mt-2 font-display text-2xl font-semibold text-ink md:text-3xl">{{ value }}</p>
    <p v-if="sub" class="mt-1 text-xs text-ink/45">{{ sub }}</p>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: String, required: true },
  sub: { type: String, default: '' }
})
</script>
