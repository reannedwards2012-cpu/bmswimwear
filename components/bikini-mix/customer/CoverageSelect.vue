<template>
  <div>
    <h2 class="font-display text-lg font-semibold text-ink">{{ heading }}</h2>

    <div class="mt-3 flex gap-3 sm:gap-4">
      <button
        type="button"
        class="flex-1 rounded-3xl border-2 bg-cream px-4 py-3.5 text-center text-sm font-semibold transition-all"
        :class="modelValue === 'bikini' ? 'border-coral text-coral shadow-card' : 'border-ink/10 text-ink/70 hover:border-ink/25'"
        :aria-pressed="modelValue === 'bikini'"
        @click="$emit('update:modelValue', 'bikini')"
      >
        Bikini
      </button>
      <button
        type="button"
        class="flex-1 rounded-3xl border-2 bg-cream px-4 py-3.5 text-center text-sm font-semibold transition-all"
        :class="modelValue === 'cheeky' ? 'border-coral text-coral shadow-card' : 'border-ink/10 text-ink/70 hover:border-ink/25'"
        :aria-pressed="modelValue === 'cheeky'"
        @click="$emit('update:modelValue', 'cheeky')"
      >
        Cheeky
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, required: true },
  heading: { type: String, default: 'Coverage' }
})
defineEmits(['update:modelValue'])
</script>
