<template>
  <nav class="flex flex-wrap gap-2 border-b border-ink/10 pb-4">
    <NuxtLink
      v-for="t in TABS"
      :key="t.to"
      :to="t.to"
      class="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
      :class="isActive(t) ? 'bg-ink text-cream' : 'bg-shell text-ink/60 hover:text-ink'"
    >
      {{ t.label }}
    </NuxtLink>
  </nav>
</template>

<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()
const TABS = [
  { label: 'New Quote', to: '/admin/quotes/new' },
  { label: 'All Quotes', to: '/admin/quotes', exact: true },
  { label: 'Settings', to: '/admin/quotes/settings' }
]
const isActive = (t) => (t.exact ? route.path === t.to : route.path.startsWith(t.to))
</script>
