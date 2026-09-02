<template>
  <label class="block">
    <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">
      {{ label }}
      <span v-if="optional" class="font-normal normal-case tracking-normal text-ink/35">(optional)</span>
    </span>

    <textarea
      v-if="type === 'textarea'"
      :value="modelValue"
      :rows="rows"
      :required="required"
      :autocomplete="autocomplete"
      :aria-invalid="error ? 'true' : undefined"
      :class="fieldClass"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <input
      v-else
      :type="type"
      :value="modelValue"
      :required="required"
      :autocomplete="autocomplete"
      :inputmode="type === 'tel' ? 'tel' : undefined"
      :aria-invalid="error ? 'true' : undefined"
      :class="fieldClass"
      @input="$emit('update:modelValue', $event.target.value)"
    >

    <p v-if="error" class="mt-1 text-xs text-coral">{{ error }}</p>
  </label>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: String, default: '' },
  type: { type: String, default: 'text' }, // text | email | tel | textarea
  autocomplete: { type: String, default: undefined },
  required: { type: Boolean, default: false },
  optional: { type: Boolean, default: false },
  error: { type: String, default: '' },
  rows: { type: [String, Number], default: 4 }
})

defineEmits(['update:modelValue'])

const fieldClass = computed(() => [
  'mt-1.5 w-full rounded-2xl border bg-sand/60 px-4 py-2.5 text-sm text-ink focus:outline-none',
  props.error ? 'border-coral' : 'border-ink/15 focus:border-coral'
])
</script>
