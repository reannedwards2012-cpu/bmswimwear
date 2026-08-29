<template>
  <div>
    <section class="border-b border-ink/10 bg-shell/50">
      <div class="container-bm py-16 md:py-20">
        <p class="eyebrow">The collection</p>
        <h1 class="mt-3 font-display text-4xl font-semibold text-ink md:text-5xl">Shop swimwear</h1>
        <p class="mt-4 max-w-xl text-lg leading-relaxed text-ink/65">
          Every piece is made to order and finished by hand. Choose a style below, or
          <NuxtLink to="/contact" class="text-ocean link-underline">commission a custom design</NuxtLink>.
        </p>
      </div>
    </section>

    <section class="container-bm py-14">
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="f in filters"
          :key="f.value"
          class="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
          :class="
            active === f.value
              ? 'border-ink bg-ink text-sand'
              : 'border-ink/15 text-ink/70 hover:border-ink/40'
          "
          @click="active = f.value"
        >
          {{ f.label }}
        </button>
        <span class="ml-auto text-sm text-ink/40">{{ visible.length }} pieces</span>
      </div>

      <div class="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        <ProductCard v-for="p in visible" :key="p.id" :product="p" />
      </div>

      <p v-if="visible.length === 0" class="mt-10 text-ink/50">
        No pieces in this category yet — check back soon.
      </p>

      <div class="mt-20 rounded-3xl bg-ink px-8 py-12 text-center text-sand md:px-14">
        <h2 class="font-display text-2xl font-semibold md:text-3xl">Don't see your perfect suit?</h2>
        <p class="mx-auto mt-3 max-w-md text-sand/75">
          Custom cuts, colours and prints are our specialty. Tell us what you're picturing.
        </p>
        <NuxtLink to="/contact" class="btn-primary mt-7">Start a custom order</NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { products } from '~/data/products.js'

const route = useRoute()

const filters = [
  { value: 'all', label: 'All' },
  { value: 'One-Piece', label: 'One-Piece' },
  { value: 'Bikini', label: 'Bikini' },
  { value: 'Cover-Up', label: 'Cover-Ups' }
]

const initial = filters.some((f) => f.value === route.query.category)
  ? String(route.query.category)
  : 'all'
const active = ref(initial)

const visible = computed(() =>
  active.value === 'all' ? products : products.filter((p) => p.category === active.value)
)
</script>
