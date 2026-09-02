<template>
  <div :class="center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'">
    <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
    <component
      :is="as"
      class="mt-3 font-display font-semibold leading-[1.05] text-ink"
      :class="sizeClass"
    >
      <template v-for="(part, i) in parts" :key="i">
        <span v-if="part.accent" class="fancy-accent">{{ part.text }}</span><template v-else>{{ part.text }}</template>
      </template>
    </component>
    <p v-if="$slots.default" class="mt-4 text-lg leading-relaxed text-ink/65">
      <slot />
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // Wrap the script-accent word(s) in *asterisks*, e.g. "What *She* Says"
  title: { type: String, required: true },
  eyebrow: { type: String, default: '' },
  center: { type: Boolean, default: false },
  as: { type: String, default: 'h2' },
  size: { type: String, default: 'md' } // 'sm' | 'md' | 'lg'
})

const sizeClass = computed(
  () =>
    ({
      sm: 'text-2xl md:text-4xl',
      lg: 'text-4xl md:text-6xl'
    })[props.size] || 'text-3xl md:text-5xl'
)

const parts = computed(() =>
  props.title
    .split(/(\*[^*]+\*)/)
    .filter(Boolean)
    .map((chunk) =>
      chunk.startsWith('*') && chunk.endsWith('*')
        ? { text: chunk.slice(1, -1) + ' ', accent: true }
        : { text: chunk, accent: false }
    )
)
</script>
