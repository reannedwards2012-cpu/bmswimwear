<template>
  <article class="group">
    <NuxtLink :to="`/shop/${product.id}`" class="block">
      <div class="relative overflow-hidden rounded-4xl bg-shell shadow-card">
        <img
          :src="product.image"
          :alt="product.title"
          loading="lazy"
          class="aspect-[3/4] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />

        <div
          class="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        >
          <span
            class="rounded-full border border-cream/40 bg-ink/20 px-7 py-3 text-xs font-semibold uppercase tracking-widest2 text-cream backdrop-blur-md"
          >
            View details
          </span>
        </div>
      </div>

      <p class="mt-4 text-[0.7rem] font-semibold uppercase tracking-widest2 text-ink/40">
        {{ product.categoryLabel }}
      </p>
      <h3 class="mt-1 font-display text-lg font-medium text-ink">{{ product.title }}</h3>
    </NuxtLink>

    <div class="mt-1.5 flex items-center justify-between gap-3">
      <p class="text-base font-semibold text-coral">{{ product.priceFormatted }}</p>
      <button
        type="button"
        aria-label="Add to bag"
        class="inline-flex items-center gap-1.5 rounded-full border border-ink/25 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-widest2 text-ink/70 transition-colors hover:border-ink hover:bg-ink hover:text-cream"
      >
        <span class="text-sm leading-none">+</span> Add
      </button>
    </div>
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
