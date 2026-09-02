<template>
  <div role="group" :aria-label="label">
    <p class="text-xs font-semibold uppercase tracking-widest2" :class="invalid ? 'text-coral' : 'text-ink/60'">
      {{ label }}
      <span :class="invalid ? 'text-coral/70' : 'text-ink/40'">· {{ selectedLabel }}</span>
    </p>
    <div class="mt-3 flex flex-wrap gap-2">
      <button
        v-for="opt in normalisedOptions"
        :key="opt.value"
        type="button"
        :aria-pressed="modelValue === opt.value"
        class="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
        :class="
          modelValue === opt.value
            ? 'border-ink bg-ink text-cream'
            : 'border-ink/15 text-ink/70 hover:border-ink/40'
        "
        @click="$emit('update:modelValue', opt.value)"
      >
        <span
          v-if="type === 'colour'"
          class="h-4 w-4 rounded-full border"
          :class="modelValue === opt.value ? 'border-cream/40 ring-2 ring-cream/60' : 'border-ink/10'"
          :style="{ backgroundColor: opt.hex }"
        />
        {{ opt.label }}
      </button>
    </div>
    <p v-if="invalid" class="mt-2 text-xs text-coral">Please select a {{ label.toLowerCase() }}.</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  // Text options: array of strings. Colour options: array of { id, name, hex }.
  options: { type: Array, required: true },
  modelValue: { type: [String, null], default: null },
  type: { type: String, default: 'text' }, // 'text' | 'colour'
  invalid: { type: Boolean, default: false }
})

defineEmits(['update:modelValue'])

// Normalise both shapes to { value, label, hex? }. `value` is what we store —
// for colours that's the fabric id, ready for the shared fabric inventory later.
const normalisedOptions = computed(() =>
  props.options.map((o) =>
    props.type === 'colour'
      ? { value: o.id, label: o.name, hex: o.hex }
      : { value: o, label: o }
  )
)

const selectedLabel = computed(() => {
  if (props.modelValue == null) return 'Select one'
  return normalisedOptions.value.find((o) => o.value === props.modelValue)?.label ?? 'Select one'
})
</script>
