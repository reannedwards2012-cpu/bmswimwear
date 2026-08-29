<template>
  <article class="group">
    <div class="relative overflow-hidden rounded-4xl bg-shell shadow-card">
      <img
        :src="product.image"
        :alt="product.name"
        loading="lazy"
        class="aspect-[4/5] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      />

      <span
        v-if="product.badge"
        class="absolute left-4 top-4 rounded-full bg-cream/95 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-widest2 text-coral shadow-sm"
      >
        {{ product.badge }}
      </span>

      <div
        class="pointer-events-none absolute inset-x-4 bottom-4 translate-y-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
      >
        <span class="flex w-full items-center justify-center rounded-full bg-ink/90 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest2 text-cream backdrop-blur">
          View details
        </span>
      </div>
    </div>

    <div class="mt-4 flex items-baseline justify-between gap-3">
      <h3 class="font-display text-lg font-medium text-ink">{{ product.name }}</h3>
      <p class="shrink-0 rounded-full bg-blush/25 px-3 py-1 text-sm font-semibold text-ink">
        {{ product.price }}
      </p>
    </div>
    <p class="mt-1 text-sm leading-relaxed text-ink/55">{{ product.description }}</p>
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
