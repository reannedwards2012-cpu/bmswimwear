<template>
  <nav :class="$attrs.class">
    <ul class="space-y-1">
      <li v-for="link in LINKS" :key="link.to">
        <NuxtLink
          :to="link.to"
          class="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors"
          :class="isActive(link) ? 'bg-ink text-cream' : 'text-ink/60 hover:bg-shell hover:text-ink'"
          @click="$emit('navigate')"
        >
          <svg viewBox="0 0 24 24" class="h-[1.15rem] w-[1.15rem] shrink-0" fill="none" stroke="currentColor" stroke-width="1.7">
            <path :d="link.icon" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ link.label }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<script setup>
import { useRoute } from 'vue-router'

defineEmits(['navigate'])
defineOptions({ inheritAttrs: false })

const route = useRoute()

const LINKS = [
  { label: 'Overview', to: '/admin', exact: true, icon: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z' },
  { label: 'Orders', to: '/admin/orders', icon: 'M6 8h12l1 12H5L6 8Zm3 0V6a3 3 0 0 1 6 0v2' },
  { label: 'Fabric Inventory', to: '/admin/fabrics', icon: 'M5 5h9v9H5V5Zm5 5h9v9h-9v-9Z' },
  { label: 'Products', to: '/admin/products', icon: 'M4 4h8l8 8-8 8-8-8V4Zm4.5 4.5h.01' },
  { label: 'Inquiries', to: '/admin/inquiries', icon: 'M3 5h18v14H3V5Zm0 0 9 7 9-7' }
]

const isActive = (link) => (link.exact ? route.path === link.to : route.path.startsWith(link.to))
</script>
