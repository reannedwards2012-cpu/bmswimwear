<template>
  <article class="group">
    <div class="relative overflow-hidden rounded-2xl bg-shell">
      <img
        :src="product.image"
        :alt="product.name"
        loading="lazy"
        class="aspect-[4/5] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      />
      <span
        v-if="product.badge"
        class="absolute left-4 top-4 rounded-full bg-sand/95 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-widest2 text-ocean"
      >
        {{ product.badge }}
      </span>
    </div>

    <div class="mt-4 flex items-baseline justify-between gap-3">
      <h3 class="font-display text-lg font-medium text-ink">{{ product.name }}</h3>
      <p class="shrink-0 font-medium text-ink">{{ product.price }}</p>
    </div>
    <p class="mt-1 text-xs uppercase tracking-widest2 text-ink/40">{{ product.category }}</p>
  </article>
</template>

<script setup>
defineProps({
  product: {
    type: Object,
    required: true
  }
})
</script>
