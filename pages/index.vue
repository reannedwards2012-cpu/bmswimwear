<template>
  <div>
    <!-- Announcement bar -->
    <div class="bg-ink text-center text-xs font-medium tracking-widest2 text-sand">
      <div class="container-bm py-2.5 uppercase">Free worldwide shipping on orders over $200 · Made to order in 2–3 weeks</div>
    </div>

    <Hero />

    <!-- Shop by category -->
    <section class="container-bm py-20 md:py-28">
      <SectionHeading eyebrow="Find your fit" title="Shop by silhouette">
        Three ways to wear Bahama Mama. Every piece is cut and sewn to order.
      </SectionHeading>

      <div class="mt-12 grid gap-6 md:grid-cols-3">
        <NuxtLink
          v-for="cat in categories"
          :key="cat.name"
          :to="`/shop?category=${cat.value}`"
          class="group relative overflow-hidden rounded-2xl"
        >
          <img
            :src="cat.image"
            :alt="cat.name"
            class="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
          <div class="absolute inset-x-0 bottom-0 p-6">
            <h3 class="font-display text-2xl font-medium text-sand">{{ cat.name }}</h3>
            <span class="mt-1 inline-flex items-center gap-1 text-sm text-sand/80">
              {{ cat.copy }}
              <span class="transition-transform group-hover:translate-x-1">→</span>
            </span>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- Featured products -->
    <section class="bg-blush/10 py-20 md:py-28">
      <div class="container-bm">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow="Just landed" title="Featured pieces" />
          <NuxtLink to="/shop" class="btn-outline">View all</NuxtLink>
        </div>

        <div class="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          <ProductCard v-for="p in featured" :key="p.id" :product="p" />
        </div>
      </div>
    </section>

    <!-- Custom design callout -->
    <section class="container-bm py-20 md:py-28">
      <div class="grid items-center gap-12 rounded-3xl bg-ink px-8 py-14 text-sand md:grid-cols-2 md:px-14">
        <div>
          <p class="eyebrow text-ocean-light">Custom &amp; bespoke</p>
          <h2 class="mt-3 font-display text-3xl font-semibold md:text-4xl">Dream it. We'll make it.</h2>
          <p class="mt-4 max-w-md text-lg leading-relaxed text-sand/75">
            Choose your cut, colour and print — or bring us a reference and we'll design something
            entirely yours. Every custom commission is pattern-drafted to your measurements.
          </p>
          <NuxtLink to="/contact" class="btn-primary mt-8">Enquire about a custom piece</NuxtLink>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <img
            src="https://images.unsplash.com/photo-1590739225287-bd31519780c3?w=700&q=80&auto=format&fit=crop"
            alt="Swimwear fabric selection"
            class="aspect-square w-full rounded-2xl object-cover"
          />
          <img
            src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=700&q=80&auto=format&fit=crop"
            alt="Tailoring detail"
            class="mt-8 aspect-square w-full rounded-2xl object-cover"
          />
        </div>
      </div>
    </section>

    <!-- Promise / values -->
    <section class="bg-shell py-20 md:py-28">
      <div class="container-bm">
        <SectionHeading eyebrow="The Bahama Mama promise" title="Affordable luxury, made to last" center />
        <div class="mt-12 grid gap-8 md:grid-cols-3">
          <div v-for="v in values" :key="v.title" class="rounded-2xl bg-cream p-8">
            <div class="grid h-11 w-11 place-items-center rounded-full bg-ocean/10 text-ocean">
              <span class="text-lg">{{ v.icon }}</span>
            </div>
            <h3 class="mt-5 font-display text-xl font-medium text-ink">{{ v.title }}</h3>
            <p class="mt-2 text-sm leading-relaxed text-ink/60">{{ v.copy }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Testimonials -->
    <section class="container-bm py-20 md:py-28">
      <SectionHeading eyebrow="Loved by island girls everywhere" title="What customers say" center />
      <div class="mt-12 grid gap-6 md:grid-cols-3">
        <figure v-for="t in testimonials" :key="t.name" class="rounded-2xl border border-ink/10 p-8">
          <div class="text-gold">★★★★★</div>
          <blockquote class="mt-4 text-sm leading-relaxed text-ink/75">"{{ t.quote }}"</blockquote>
          <figcaption class="mt-5 text-xs font-semibold uppercase tracking-widest2 text-ink/45">
            {{ t.name }} · {{ t.location }}
          </figcaption>
        </figure>
      </div>
    </section>

    <!-- Newsletter -->
    <section class="container-bm pb-24">
      <div class="rounded-3xl bg-blush px-8 py-14 text-center text-ink md:px-14">
        <p class="font-script text-2xl text-ink/70">Island soul, straight to your inbox</p>
        <h2 class="mt-1 font-display text-3xl font-semibold md:text-4xl">Join the list</h2>
        <p class="mx-auto mt-3 max-w-md text-ink/70">
          Early access to new drops, restock alerts and members-only pricing.
        </p>
        <form class="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row" @submit.prevent="subscribed = true">
          <input
            v-model="email"
            type="email"
            required
            placeholder="you@email.com"
            class="w-full rounded-full border border-ink/20 bg-sand/60 px-5 py-3 text-sm text-ink placeholder:text-ink/40 focus:border-ink focus:outline-none"
          />
          <button type="submit" class="btn-dark">Subscribe</button>
        </form>
        <p v-if="subscribed" class="mt-4 text-sm font-medium text-ink">Thanks — you're on the list! 🌺</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { products } from '~/data/products.js'

const featured = products.slice(0, 3)

const categories = [
  {
    name: 'One-Pieces',
    value: 'One-Piece',
    copy: 'Sculpted & supportive',
    image: 'https://images.unsplash.com/photo-1570976447640-ac859083963f?w=800&q=80&auto=format&fit=crop'
  },
  {
    name: 'Bikinis',
    value: 'Bikini',
    copy: 'Mix, match, tie your way',
    image: 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?w=800&q=80&auto=format&fit=crop'
  },
  {
    name: 'Cover-Ups',
    value: 'Cover-Up',
    copy: 'Beach to boardwalk',
    image: 'https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=800&q=80&auto=format&fit=crop'
  }
]

const values = [
  { icon: '✂️', title: 'Cut for you', copy: 'Made to order in your size, so it fits the way swimwear should — no compromises.' },
  { icon: '🌊', title: 'Built for the water', copy: 'Chlorine- and salt-resistant fabrics with double-lined finishing that holds its shape.' },
  { icon: '🌴', title: 'Made in the Caribbean', copy: 'Designed and sewn by a small island team that takes real pride in every seam.' }
]

const testimonials = [
  { name: 'Aaliyah', location: 'Barbados', quote: 'The fit is unreal. It actually stays put when I dive in — first swimsuit that has.' },
  { name: 'Simone', location: 'London', quote: 'Ordered a custom colour for my honeymoon and got so many compliments. Worth every penny.' },
  { name: 'Renée', location: 'Toronto', quote: 'Feminine, flattering and it arrived beautifully packaged. Already planning my next order.' }
]

const email = ref('')
const subscribed = ref(false)
</script>
