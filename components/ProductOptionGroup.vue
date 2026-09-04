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
        :disabled="opt.disabled"
        :aria-pressed="modelValue === opt.value"
        :aria-disabled="opt.disabled ? 'true' : undefined"
        class="group relative flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
        :class="
          opt.disabled
            ? 'cursor-not-allowed border-ink/10 text-ink/35 opacity-50'
            : modelValue === opt.value
              ? 'border-ink bg-ink text-cream'
              : 'border-ink/15 text-ink/70 hover:border-ink/40'
        "
        @click="opt.disabled ? null : $emit('update:modelValue', opt.value)"
      >
        <span
          v-if="type === 'colour'"
          class="h-4 w-4 rounded-full border bg-cover bg-center"
          :class="!opt.disabled && modelValue === opt.value ? 'border-cream/40 ring-2 ring-cream/60' : 'border-ink/10'"
          :style="opt.imageUrl ? { backgroundImage: `url(${opt.imageUrl})` } : { backgroundColor: opt.hex }"
        />
        <span :class="opt.disabled ? 'line-through' : ''">{{ opt.label }}</span>

        <!-- enlarged preview: image-based fabrics only. Absolutely positioned
             (never affects layout). Desktop: shows on hover of any image
             swatch. Touch: forced visible while this swatch is the selected
             one, so a single tap both selects and reveals the preview. -->
        <span
          v-if="type === 'colour' && opt.imageUrl"
          aria-hidden="true"
          class="pointer-events-none absolute left-1/2 top-full z-20 mt-2 h-20 w-20 -translate-x-1/2 rounded-2xl border-2 border-cream bg-cover bg-center opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100 sm:h-24 sm:w-24"
          :class="modelValue === opt.value ? 'opacity-100' : ''"
          :style="{ backgroundImage: `url(${opt.imageUrl})` }"
        />
      </button>
    </div>
    <p v-if="invalid" class="mt-2 text-xs text-coral">Please select a {{ label.toLowerCase() }}.</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  // Text options: array of strings.
  // Colour options: array of { id, name, hex, imageUrl?, status? } — status
  // 'unavailable' renders the swatch disabled (still visible, not
  // selectable). imageUrl (prints/specialty fabrics), when present, is used
  // for the swatch instead of the hex colour.
  options: { type: Array, required: true },
  modelValue: { type: [String, null], default: null },
  type: { type: String, default: 'text' }, // 'text' | 'colour'
  invalid: { type: Boolean, default: false }
})

defineEmits(['update:modelValue'])

// Normalise both shapes to { value, label, hex?, imageUrl?, disabled? }.
// `value` is what we store — for colours that's the fabric slug, ready for
// the shared fabric inventory. 'available' and 'low' both stay selectable;
// only 'unavailable' disables the swatch — there is no customer-facing
// "low stock" warning yet.
const normalisedOptions = computed(() =>
  props.options.map((o) =>
    props.type === 'colour'
      ? { value: o.id, label: o.name, hex: o.hex, imageUrl: o.imageUrl ?? null, disabled: o.status === 'unavailable' }
      : { value: o, label: o }
  )
)

const selectedLabel = computed(() => {
  if (props.modelValue == null) return 'Select one'
  return normalisedOptions.value.find((o) => o.value === props.modelValue)?.label ?? 'Select one'
})
</script>
