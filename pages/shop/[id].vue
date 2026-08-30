<template>
  <div class="section container-bm">
    <!-- breadcrumb -->
    <nav class="flex flex-wrap items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-widest2 text-ink/40">
      <NuxtLink to="/shop" class="hover:text-ink">Shop</NuxtLink>
      <span>/</span>
      <NuxtLink :to="`/shop?category=${product.category}`" class="hover:text-ink">{{ product.categoryLabel }}</NuxtLink>
      <span>/</span>
      <span class="text-ink/60">{{ product.title }}</span>
    </nav>

    <div class="mt-8 grid gap-10 md:grid-cols-2 md:mt-10 lg:gap-16">
      <!-- gallery -->
      <div>
        <div class="overflow-hidden rounded-4xl bg-shell shadow-card">
          <img
            :src="activeImage"
            :alt="product.title"
            class="aspect-[4/5] w-full object-cover"
          />
        </div>
        <div v-if="product.images.length > 1" class="mt-4 flex flex-wrap gap-3">
          <button
            v-for="(img, i) in product.images"
            :key="i"
            type="button"
            class="overflow-hidden rounded-2xl border-2 transition-colors"
            :class="activeIndex === i ? 'border-ink' : 'border-transparent hover:border-ink/30'"
            @click="activeIndex = i"
          >
            <img :src="img" :alt="`${product.title} — view ${i + 1}`" class="h-20 w-16 object-cover" />
          </button>
        </div>
      </div>

      <!-- info -->
      <div>
        <p class="eyebrow">{{ product.categoryLabel }}</p>
        <h1 class="mt-2 font-display text-3xl font-semibold text-ink md:text-4xl">{{ product.title }}</h1>

        <div class="mt-4 flex flex-wrap items-center gap-3">
          <span class="rounded-full bg-blush/25 px-4 py-1.5 text-base font-semibold text-ink">
            {{ product.priceFormatted }}
          </span>
          <span
            v-if="stockNote"
            class="text-xs font-semibold uppercase tracking-widest2 text-coral"
          >
            {{ stockNote }}
          </span>
        </div>

        <p v-if="description" class="mt-6 leading-relaxed text-ink/70">{{ description }}</p>

        <!-- colours -->
        <div v-if="product.colours.length" class="mt-8">
          <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Colour</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <span
              v-for="c in product.colours"
              :key="c.name"
              class="flex items-center gap-2 rounded-full border border-ink/15 px-3 py-1.5 text-sm text-ink/70"
            >
              <span class="h-4 w-4 rounded-full border border-ink/10" :style="{ backgroundColor: c.hex }" />
              {{ c.name }}
            </span>
          </div>
        </div>

        <!-- prints -->
        <div v-if="product.prints.length" class="mt-8">
          <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Print</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <span
              v-for="pr in product.prints"
              :key="pr"
              class="rounded-full border border-ink/15 px-4 py-1.5 text-sm text-ink/70"
            >
              {{ pr }}
            </span>
          </div>
        </div>

        <!-- sizes -->
        <div v-if="product.sizes.length" class="mt-8">
          <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Size</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="s in product.sizes"
              :key="s"
              type="button"
              class="min-w-[3rem] rounded-full border px-4 py-2 text-sm font-medium transition-colors"
              :class="
                selectedSize === s
                  ? 'border-ink bg-ink text-cream'
                  : 'border-ink/15 text-ink/70 hover:border-ink/40'
              "
              @click="selectedSize = s"
            >
              {{ s }}
            </button>
          </div>
        </div>

        <!-- add to cart (visual only for now) -->
        <button
          type="button"
          :disabled="!product.inStock"
          class="btn-primary mt-8 w-full shadow-soft disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[16rem]"
        >
          {{ product.inStock ? 'Add to cart' : 'Sold out' }}
        </button>

        <!-- fit & details -->
        <div v-if="product.details.length" class="mt-10 border-t border-ink/10 pt-6">
          <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Fit &amp; details</p>
          <ul class="mt-3 space-y-2 text-sm leading-relaxed text-ink/70">
            <li v-for="d in product.details" :key="d" class="flex gap-2">
              <span class="text-coral">·</span>{{ d }}
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- you may also like -->
    <div v-if="related.length" class="mt-20 md:mt-28">
      <h2 class="font-display text-2xl font-semibold text-ink md:text-3xl">
        You may also <span class="fancy-accent">like</span>
      </h2>
      <div class="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3">
        <ProductCard v-for="p in related" :key="p.id" :product="p" />
      </div>
    </div>

    <div class="mt-16 text-center">
      <NuxtLink to="/shop" class="btn-outline">Back to shop</NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { getProductById, getRelatedProducts } from '~/data/products.js'

// Re-mount the page when navigating between products (e.g. via "You may also like").
definePageMeta({ key: (route) => route.fullPath })

const route = useRoute()
const product = getProductById(route.params.id)

if (!product) {
  throw createError({ statusCode: 404, statusMessage: 'Product not found', fatal: true })
}

useHead({ title: `${product.title} — Bahama Mama Swimwear` })

const activeIndex = ref(0)
const activeImage = computed(() => product.images[activeIndex.value] ?? product.image)

const selectedSize = ref(null)

const description = computed(() => product.longDescription || product.description || '')

const stockNote = computed(() => {
  if (!product.inStock) return 'Sold out'
  if (product.lowStock) return `Only ${product.stock} left`
  return ''
})

const related = computed(() => getRelatedProducts(product, 3))
</script>
