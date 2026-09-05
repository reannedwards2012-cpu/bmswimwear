<template>
  <div>
    <section class="border-b border-ink/10 bg-shell/60">
      <div class="container-bm py-16 md:py-20 text-center">
        <FancyHeading eyebrow="Swim, Your Way" title="Find Your *Favourite*" center size="lg">
          Find the one that feels like you, or make it completely your own with a
          custom design.
        </FancyHeading>
      </div>
    </section>

    <section class="section container-bm">
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="f in filters"
          :key="f.value"
          class="rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-widest2 transition-colors"
          :class="
            active === f.value
              ? 'border-ink bg-ink text-cream'
              : 'border-ink/15 text-ink/60 hover:border-ink/40 hover:text-ink'
          "
          @click="active = f.value"
        >
          {{ f.label }}
        </button>
        <span class="ml-auto text-sm text-ink/40">{{ visible.length }} pieces</span>
      </div>

      <p v-if="pending" class="mt-10 text-ink/50">Loading pieces…</p>
      <p v-else-if="error" class="mt-10 text-coral">Couldn’t load the collection. Please refresh.</p>

      <template v-else>
        <div class="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          <ProductCard v-for="p in visible" :key="p.id" :product="p" />
        </div>

        <p v-if="visible.length === 0" class="mt-10 text-ink/50">
          No pieces in this category yet — check back soon.
        </p>
      </template>

      <div class="mt-20 rounded-4xl bg-ink px-8 py-12 text-center text-cream shadow-soft md:px-14">
        <h2 class="font-display text-2xl font-semibold md:text-3xl">
          Don't see your <span class="fancy-accent">perfect</span> suit?
        </h2>
        <p class="mx-auto mt-3 max-w-md text-cream/75">
          Custom cuts, colours and prints are our specialty. Tell us what you're picturing.
        </p>
        <NuxtLink to="/contact" class="btn-primary mt-7">Start a custom order</NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { CATEGORIES } from '~/data/constants.js'

const route = useRoute()
const { products, pending, error } = useProductList()

// Category value === label (the canonical string) — no slug/label pair.
const filters = [{ value: 'all', label: 'All' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]

const initial = filters.some((f) => f.value === route.query.category)
  ? String(route.query.category)
  : 'all'
const active = ref(initial)

const visible = computed(() =>
  active.value === 'all' ? products.value : products.value.filter((p) => p.category === active.value)
)
</script>
