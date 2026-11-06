<template>
  <div
    v-if="count > 0"
    class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-full bg-ink px-5 py-3 text-cream shadow-card"
  >
    <p class="text-sm font-semibold">{{ count }} selected</p>
    <div class="flex flex-wrap items-center gap-4">
      <button
        type="button"
        class="text-xs font-semibold uppercase tracking-widest2 text-cream/70 transition-colors hover:text-cream"
        @click="$emit('clear')"
      >
        Clear selection
      </button>
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({ count: { type: Number, required: true } })
defineEmits(['clear'])
</script>
