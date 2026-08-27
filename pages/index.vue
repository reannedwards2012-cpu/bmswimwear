<template>
  <div class="min-h-screen flex flex-col">
    <header class="py-6 px-6 md:px-12 flex items-center justify-between">
      <div class="text-xl font-semibold tracking-wide">Bahama Mama Swimwear</div>
      <nav class="space-x-6 text-sm text-gray-700 hidden md:flex">
        <a href="#products" class="hover:underline">Products</a>
        <a href="#about" class="hover:underline">About</a>
        <a href="#contact" class="hover:underline">Contact</a>
      </nav>
    </header>

    <main class="flex-1">
      <Hero />

      <section id="products" class="max-w-6xl mx-auto px-6 md:px-12 py-16">
        <h2 class="text-2xl md:text-3xl font-semibold mb-6">Featured pieces</h2>
        <p class="text-gray-600 mb-8 max-w-2xl">Made-to-order swimwear designed and crafted in Grenada. Minimal, modern silhouettes that flatter every body.</p>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <ProductCard
            v-for="p in products"
            :key="p.id"
            :product="p"
          />
        </div>
      </section>

      <section id="about" class="bg-gray-50 py-16">
        <div class="max-w-4xl mx-auto px-6 md:px-12">
          <h3 class="text-xl font-semibold mb-4">About Bahama Mama</h3>
          <p class="text-gray-700">Bahama Mama Swimwear offers handcrafted, made-to-order swimwear from Grenada. We focus on sustainable small-batch production, timeless designs, and personalized fits — made for the island life and beyond.</p>
        </div>
      </section>

      <section id="contact" class="py-16">
        <div class="max-w-3xl mx-auto px-6 md:px-12 text-center">
          <h4 class="text-lg font-semibold mb-2">Place an order or ask a question</h4>
          <p class="text-gray-600 mb-6">Email us at <a href="mailto:order@bahamamama.gd" class="text-brand hover:underline">order@bahamamama.gd</a> or use the button below to message us on Instagram.</p>
          <a href="#" class="inline-block bg-brand text-white px-6 py-3 rounded-md">Message us on Instagram</a>
        </div>
      </section>
    </main>

    <Footer />
  </div>
</template>

<script setup>
import Hero from '~/components/Hero.vue'
import ProductCard from '~/components/ProductCard.vue'
import Footer from '~/components/Footer.vue'

const products = [
  {
    id: 1,
    name: 'Sunny One-Piece',
    price: '$85',
    image: 'https://images.unsplash.com/photo-1503342452485-86f7f42c8f46?w=1200&q=80&auto=format&fit=crop',
    description: 'Minimal one-piece with moderate coverage and clean lines.'
  },
  {
    id: 2,
    name: 'Coral Bikini',
    price: '$65',
    image: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=1200&q=80&auto=format&fit=crop',
    description: 'Two-piece with adjustable straps and flattering cut.'
  },
  {
    id: 3,
    name: 'Island High-Waist',
    price: '$70',
    image: 'https://images.unsplash.com/photo-1520975698516-0a2a5f21a6f4?w=1200&q=80&auto=format&fit=crop',
    description: 'High-waist brief with modern silhouette.'
  }
]
</script>
