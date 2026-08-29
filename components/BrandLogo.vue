<template>
  <NuxtLink to="/" class="group inline-flex items-center" aria-label="Bahama Mama Swimwear — home">
    <!--
      Drop the trimmed, transparent-background logo at  public/logo.png
      (a gold-on-transparent PNG/SVG works on both the cream header and the
      cocoa footer). Until then, the styled wordmark below is shown.
    -->
    <img
      v-if="!imgFailed"
      :src="logoSrc"
      alt="Bahama Mama Swimwear"
      class="h-11 w-auto md:h-12"
      @error="imgFailed = true"
    />

    <span v-else class="flex items-center gap-3">
      <span
        class="grid h-10 w-10 place-items-center rounded-full border border-gold/60 text-gold transition-colors duration-200 group-hover:border-gold group-hover:bg-gold/10"
      >
        <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M6 9a6 6 0 0 1 12 0" stroke-linecap="round" />
          <path d="M3.5 9h17" stroke-linecap="round" />
          <path d="M12 9c1.2 1.6 2 3.4 2 5a2 2 0 1 1-4 0c0-1.6.8-3.4 2-5Z" />
        </svg>
      </span>
      <span class="leading-none">
        <span class="block font-display text-xl font-semibold tracking-tight text-ink">Bahama Mama</span>
        <span class="-mt-0.5 block font-script text-lg text-ocean">Swimwear</span>
      </span>
    </span>
  </NuxtLink>
</template>

<script setup>
import { ref } from 'vue'

// Runtime path (not build-time resolved) so a missing file falls back cleanly.
const logoSrc = '/logo.png'
const imgFailed = ref(false)
</script>
