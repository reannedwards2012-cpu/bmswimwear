<template>
  <nav class="flex flex-wrap gap-2">
    <NuxtLink
      to="/admin/fabrics"
      class="rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest2 transition-colors"
      :class="active === 'fabrics' ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/60 hover:border-ink/40'"
    >
      Fabric inventory
    </NuxtLink>
    <NuxtLink
      to="/admin/orders"
      class="rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest2 transition-colors"
      :class="active === 'orders' ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/60 hover:border-ink/40'"
    >
      Orders
    </NuxtLink>
  </nav>
</template>

<script setup>
defineProps({
  active: { type: String, required: true } // 'fabrics' | 'orders'
})
</script>
