<template>
  <div class="max-w-2xl" :class="center ? 'mx-auto text-center' : ''">
    <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
    <h2 class="mt-3 font-display text-3xl font-semibold text-ink md:text-4xl">
      <slot name="title">{{ title }}</slot>
    </h2>
    <p v-if="$slots.default" class="mt-4 text-lg leading-relaxed text-ink/65">
      <slot />
    </p>
  </div>
</template>

<script setup>
defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, default: '' },
  center: { type: Boolean, default: false }
})
</script>
