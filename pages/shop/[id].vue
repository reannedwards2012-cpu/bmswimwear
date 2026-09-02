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

    <div class="mt-8 grid gap-10 md:mt-10 md:grid-cols-2 lg:gap-16">
      <!-- gallery -->
      <div>
        <div class="overflow-hidden rounded-4xl bg-shell shadow-card">
          <img
            :src="activeImage"
            :alt="product.title"
            class="aspect-[3/4] w-full object-cover"
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
            <img :src="img" :alt="`${product.title} — view ${i + 1}`" class="aspect-[3/4] w-16 object-cover" />
          </button>
        </div>
      </div>

      <!-- info -->
      <div>
        <p class="eyebrow">{{ product.categoryLabel }}</p>
        <h1 class="mt-2 font-display text-3xl font-semibold text-ink md:text-4xl">{{ product.title }}</h1>

        <div class="mt-4">
          <span class="rounded-full bg-blush/25 px-4 py-1.5 text-base font-semibold text-ink">
            USD {{ product.priceFormatted }}
          </span>
          <p class="mt-2 text-xs text-ink/50">Made to order · {{ product.turnaround }}</p>
        </div>

        <p v-if="product.description" class="mt-6 leading-relaxed text-ink/70">{{ product.description }}</p>

        <!-- colour -->
        <ProductOptionGroup
          v-if="product.colours.length"
          v-model="selectedColour"
          label="Colour"
          type="colour"
          :options="product.colours"
          :invalid="showErrors && missingOptions.includes('colour')"
          class="mt-8"
        />

        <!-- coverage -->
        <ProductOptionGroup
          v-if="product.coverage.length"
          v-model="selectedCoverage"
          label="Coverage"
          :options="product.coverage"
          :invalid="showErrors && missingOptions.includes('coverage')"
          class="mt-8"
        />

        <!-- size -->
        <ProductOptionGroup
          v-if="product.sizes.length"
          v-model="selectedSize"
          label="Size"
          :options="product.sizes"
          :invalid="showErrors && missingOptions.includes('size')"
          class="mt-8"
        />

        <!-- add to cart -->
        <button
          type="button"
          class="btn-primary mt-8 w-full shadow-soft sm:w-auto sm:min-w-[16rem]"
          @click="onAddToCart"
        >
          Add to cart
        </button>

        <p
          v-if="showErrors && missingOptions.length"
          class="mt-3 text-sm text-coral"
        >
          Please choose {{ missingLabel }} before adding to cart.
        </p>

        <!-- details -->
        <div v-if="product.details.length" class="mt-10 border-t border-ink/10 pt-6">
          <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Details</p>
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

// No option is pre-selected — the customer makes an intentional choice.
// `selectedColour` stores the fabric id (e.g. 'royal-blue'), not the display
// name, so it maps straight onto the shared fabric inventory later.
const selectedColour = ref(null)
const selectedSize = ref(null)
const selectedCoverage = ref(null)

// Which options this specific product actually offers → which are required.
const requiredOptions = computed(() => {
  const r = []
  if (product.colours.length) r.push('colour')
  if (product.coverage.length) r.push('coverage')
  if (product.sizes.length) r.push('size')
  return r
})
const missingOptions = computed(() =>
  requiredOptions.value.filter((opt) => {
    if (opt === 'colour') return !selectedColour.value
    if (opt === 'coverage') return !selectedCoverage.value
    return !selectedSize.value
  })
)
const missingLabel = computed(() => {
  const names = { colour: 'a colour', coverage: 'a coverage', size: 'a size' }
  const list = missingOptions.value.map((o) => names[o])
  if (list.length <= 1) return list[0] ?? ''
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
})

const { addItem, openDrawer } = useCart()
const showErrors = ref(false)

function onAddToCart() {
  if (missingOptions.value.length) {
    showErrors.value = true
    return
  }

  const colour = product.colours.find((c) => c.id === selectedColour.value)
  addItem(product, {
    size: selectedSize.value,
    colourId: colour?.id ?? null,
    colourName: colour?.name ?? null,
    coverage: selectedCoverage.value
  })

  showErrors.value = false
  openDrawer()
}

const related = computed(() => getRelatedProducts(product, 3))
</script>
