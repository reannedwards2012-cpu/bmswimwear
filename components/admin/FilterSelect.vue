<template>
  <!--
    Compact labelled filter dropdown for the admin list pages. Replaces the
    horizontal pill/button rows. The <select> is wrapped in its <label> so it
    is accessibly named without needing a generated id, and stays fully
    keyboard-navigable (native select). Styling matches the admin search
    fields — rounded-full, bg-cream, coral focus ring.
    Width is set by the caller (pass a `class` such as `sm:w-44`).
  -->
  <label class="block">
    <span class="block text-xs font-semibold uppercase tracking-widest2 text-ink/50">{{ label }}</span>
    <span class="relative mt-1.5 block">
      <select
        :value="modelValue"
        class="w-full appearance-none rounded-full border border-ink/15 bg-cream py-2 pl-4 pr-9 text-sm text-ink transition-colors focus:border-coral focus:outline-none"
        @change="$emit('update:modelValue', $event.target.value)"
      >
        <option v-for="o in options" :key="String(o.value)" :value="o.value" :disabled="o.disabled">
          {{ o.label }}
        </option>
      </select>
      <svg
        class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
  </label>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  // string | number — matched against option.value
  modelValue: { type: [String, Number], default: '' },
  // [{ value, label, disabled? }]
  options: { type: Array, required: true }
})
defineEmits(['update:modelValue'])
</script>
