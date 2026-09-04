<template>
  <NuxtLink
    :to="loggedIn ? '/account' : '/login'"
    class="grid h-10 w-10 place-items-center rounded-full text-ink/80 transition-colors hover:text-ink"
    :aria-label="loggedIn ? 'My account' : 'Sign in'"
  >
    <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6" stroke-linecap="round" />
    </svg>
  </NuxtLink>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'

// Auth state is client-only (localStorage session). Render the logged-out
// target during SSR + initial hydration, then react once mounted — this avoids
// a hydration mismatch without needing a <ClientOnly> wrapper + fallback.
const { isLoggedIn } = useAuth()
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})
const loggedIn = computed(() => mounted.value && isLoggedIn.value)
</script>
