<template>
  <div class="overflow-hidden">
    <!-- Announcement bar -->
    <div class="bg-ink text-center text-[0.7rem] font-semibold uppercase tracking-widest2 text-cream">
      <div class="container-bm py-2.5">🌸 Free worldwide shipping over $200 · Made just for you in 2–3 weeks</div>
    </div>

    <!-- 1 · HERO -->
    <Hero />

    <!-- 2 · PRODUCT GRID BY CATEGORY -->
    <section id="shop" class="section container-bm">
      <FancyHeading
        eyebrow="The Collection"
        title="Curated for *Her*"
        center
      >
        Every piece is designed to celebrate your silhouette — bold prints, luxe
        fabrics and an easy Caribbean confidence.
      </FancyHeading>

      <!-- category tabs -->
      <div class="mt-10 flex flex-wrap justify-center gap-2 md:gap-3">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          type="button"
          class="rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-widest2 transition-colors"
          :class="
            activeTab === tab.value
              ? 'border-ink bg-ink text-cream'
              : 'border-ink/15 text-ink/60 hover:border-ink/40 hover:text-ink'
          "
          @click="activeTab = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- up to 12 products · 4 columns × 3 rows -->
      <div class="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        <ProductCard v-for="p in visibleProducts" :key="p.id" :product="p" />
      </div>

      <p v-if="visibleProducts.length === 0" class="mt-10 text-center text-ink/50">
        New pieces landing soon — check back shortly.
      </p>

      <div class="mt-12 text-center">
        <NuxtLink
          :to="activeTab === 'all' ? '/shop' : `/shop?category=${activeTab}`"
          class="btn-outline"
        >
          View the full collection
        </NuxtLink>
      </div>
    </section>

    <!-- 3 · CUSTOM ORDER INFO -->
    <section id="custom" class="bg-shell">
      <div class="container-bm grid items-stretch gap-0 md:grid-cols-2">
        <div class="relative min-h-[420px] overflow-hidden rounded-4xl md:my-16">
          <div class="absolute inset-0 bg-gradient-to-br from-ink via-ocean to-coral" />
          <img
            src="https://picsum.photos/seed/bahama-custom/900/1100"
            alt="Swimwear being hand-finished in the studio"
            class="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-multiply"
          />
          <div class="absolute inset-x-0 bottom-0 p-8">
            <p class="text-xs font-semibold uppercase tracking-widest2 text-cream/70">The Experience</p>
            <p class="mt-2 font-display text-3xl font-semibold text-cream md:text-4xl">
              Your vision.<br />Our craft.
            </p>
          </div>
        </div>

        <div class="py-14 md:py-24 md:pl-14">
          <FancyHeading eyebrow="Made-to-order" title="Designed *Exclusively* for You" />
          <p class="mt-5 max-w-md text-lg leading-relaxed text-ink/70">
            Every Bahama Mama piece is cut to your exact measurements. No mass
            production, no compromises — just swimwear that fits like it was made
            for you. Because it was.
          </p>

          <ol class="mt-10 space-y-7">
            <li v-for="(step, i) in steps" :key="step.title" class="flex gap-5">
              <span class="font-display text-2xl font-semibold text-coral">0{{ i + 1 }}</span>
              <div>
                <h4 class="font-semibold text-ink">{{ step.title }}</h4>
                <p class="mt-1 text-sm leading-relaxed text-ink/60">{{ step.body }}</p>
              </div>
            </li>
          </ol>

          <NuxtLink to="/contact" class="btn-primary mt-10 w-full shadow-soft sm:w-auto">
            Start your custom order
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- 4 · TESTIMONIALS -->
    <section class="section container-bm">
      <FancyHeading eyebrow="Love Letters" title="What *She* Says" center />

      <div class="mt-14 grid gap-6 md:grid-cols-3">
        <figure
          v-for="(t, i) in testimonials"
          :key="t.name"
          class="rounded-4xl p-8 shadow-card"
          :class="i === 1 ? 'bg-ink text-cream md:-translate-y-4' : 'bg-cream text-ink'"
        >
          <div class="text-coral">★★★★★</div>
          <blockquote
            class="mt-4 font-display text-lg italic leading-relaxed"
            :class="i === 1 ? 'text-cream/90' : 'text-ink/80'"
          >
            "{{ t.quote }}"
          </blockquote>
          <figcaption class="mt-6 flex items-center gap-3">
            <span
              class="grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-cream"
              :class="['bg-blush-deep', 'bg-coral', 'bg-ink'][i % 3]"
            >
              {{ t.name.charAt(0) }}
            </span>
            <span>
              <span class="block text-sm font-semibold">{{ t.name }}</span>
              <span class="block text-xs" :class="i === 1 ? 'text-cream/60' : 'text-ink/45'">{{ t.location }}</span>
            </span>
          </figcaption>
        </figure>
      </div>
    </section>

    <!-- 5 · LOOKBOOK -->
    <section class="section bg-shell">
      <div class="container-bm">
        <FancyHeading eyebrow="The Lookbook" title="Caribbean *State of Mind*" center />
      </div>

      <div class="mt-12 flex gap-5 overflow-x-auto scrollbar-hide px-6 pb-4 md:px-10">
        <article
          v-for="look in lookbook"
          :key="look.title"
          class="relative flex aspect-[3/4] w-[76vw] shrink-0 snap-start overflow-hidden rounded-4xl shadow-card sm:w-[46vw] lg:w-[30vw]"
        >
          <div class="absolute inset-0" :class="look.gradient" />
          <img
            :src="look.image"
            :alt="look.title"
            loading="lazy"
            class="absolute inset-0 h-full w-full object-cover opacity-55 mix-blend-multiply"
          />
          <div class="absolute inset-x-0 bottom-0 p-7">
            <p class="text-[0.65rem] font-semibold uppercase tracking-widest2 text-cream/80">{{ look.kicker }}</p>
            <p class="mt-1 font-display text-2xl font-semibold text-cream">{{ look.title }}</p>
          </div>
        </article>
      </div>
    </section>

    <!-- 6 · ABOUT (brief) -->
    <section id="about" class="section container-bm">
      <div class="grid items-center gap-12 md:grid-cols-2">
        <div class="relative">
          <div class="aspect-square w-4/5 rounded-4xl bg-gradient-to-br from-ink to-coral shadow-card">
            <img
              src="https://picsum.photos/seed/bahama-about-1/800/800"
              alt="Bahama Mama studio"
              class="h-full w-full rounded-4xl object-cover opacity-80"
            />
          </div>
          <div class="absolute -bottom-8 right-0 aspect-square w-1/2 rounded-4xl bg-blush shadow-soft">
            <img
              src="https://picsum.photos/seed/bahama-about-2/600/600"
              alt="Caribbean coast"
              class="h-full w-full rounded-4xl object-cover"
            />
          </div>
        </div>

        <div>
          <FancyHeading eyebrow="Our Story" title="Born from the *Islands*" />
          <p class="mt-5 text-lg leading-relaxed text-ink/75">
            Bahama Mama Swimwear started with a simple belief: every woman deserves
            swimwear that makes her feel extraordinary.
          </p>
          <p class="mt-4 leading-relaxed text-ink/60">
            Rooted in Caribbean colour and culture, we design pieces that celebrate
            femininity and confidence — made-to-order in premium, sustainable
            fabrics because luxury should never cost the planet.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <NuxtLink to="/about" class="btn-outline">Read our story</NuxtLink>
          </div>
          <dl class="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-ink/10 pt-6">
            <div v-for="s in stats" :key="s.label">
              <dt class="font-display text-3xl font-semibold text-coral">{{ s.value }}</dt>
              <dd class="mt-1 text-[0.7rem] uppercase tracking-widest2 text-ink/45">{{ s.label }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>

    <!-- 7 · JOIN EMAIL LIST -->
    <section class="bg-ink">
      <div class="container-bm grid items-center gap-10 py-16 md:grid-cols-2 md:py-20">
        <div>
          <p class="eyebrow text-blush">Stay in the loop</p>
          <h2 class="mt-3 font-display text-4xl font-semibold text-cream md:text-5xl">
            Join the <span class="fancy-accent">Island List</span>
          </h2>
          <p class="mt-4 max-w-md text-cream/70">
            First dibs on new collections, exclusive drops and island-inspired
            style notes. Plus 10% off your first order.
          </p>
        </div>
        <div>
          <form class="flex flex-col gap-3 sm:flex-row" @submit.prevent="subscribed = true">
            <input
              v-model="email"
              type="email"
              required
              placeholder="Your email address"
              class="w-full rounded-full border border-cream/25 bg-cream/10 px-5 py-3.5 text-sm text-cream placeholder:text-cream/50 focus:border-cream focus:outline-none"
            />
            <button type="submit" class="btn bg-blush text-ink hover:bg-blush-soft">Subscribe</button>
          </form>
          <p class="mt-3 text-xs text-cream/50">
            {{ subscribed ? "You're on the list — see you in your inbox! 🌴" : 'No spam, ever. Just island vibes. 🌴' }}
          </p>
        </div>
      </div>
    </section>

    <!-- 8 · CONTACT -->
    <section id="contact" class="section container-bm">
      <FancyHeading eyebrow="Get in Touch" title="Let's *Connect*" center>
        Starting a custom order or just want to say hi? We'd love to hear from you.
      </FancyHeading>

      <div class="mx-auto mt-12 grid max-w-4xl gap-10 md:grid-cols-[1.3fr_1fr]">
        <form class="space-y-4 rounded-4xl bg-cream p-7 shadow-card md:p-9" @submit.prevent="sent = true">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">First name</span>
              <input v-model="form.first" type="text" required class="mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Last name</span>
              <input v-model="form.last" type="text" class="mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none" />
            </label>
          </div>
          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Email</span>
            <input v-model="form.email" type="email" required class="mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none" />
          </label>
          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Subject</span>
            <select v-model="form.subject" class="mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none">
              <option>Custom / bespoke design</option>
              <option>Sizing &amp; fit help</option>
              <option>An existing order</option>
              <option>Just saying hi</option>
            </select>
          </label>
          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Message</span>
            <textarea v-model="form.message" rows="4" required class="mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none"></textarea>
          </label>
          <button type="submit" class="btn-primary w-full shadow-soft">Send message</button>
          <p v-if="sent" class="text-sm text-coral">
            Thanks {{ form.first || 'love' }} — message noted! (Front-end only for now — nothing is sent yet.)
          </p>
        </form>

        <aside class="space-y-4">
          <div class="rounded-4xl bg-cream p-6 shadow-card">
            <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Visit us</p>
            <p class="mt-2 text-sm text-ink/70">St. George's, Grenada<br />Caribbean, West Indies</p>
          </div>
          <div class="rounded-4xl bg-cream p-6 shadow-card">
            <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Email us</p>
            <a href="mailto:hello@bahamamamaswim.com" class="mt-2 block text-sm text-coral link-underline">hello@bahamamamaswim.com</a>
          </div>
          <div class="rounded-4xl bg-cream p-6 shadow-card">
            <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Follow along</p>
            <div class="mt-3 flex gap-2">
              <a
                v-for="s in socials"
                :key="s.label"
                :href="s.href"
                :aria-label="s.label"
                class="grid h-9 w-9 place-items-center rounded-full border border-ink/15 text-[0.65rem] font-semibold text-ink/70 transition-colors hover:border-coral hover:text-coral"
              >{{ s.short }}</a>
            </div>
          </div>
          <div class="rounded-4xl bg-ink p-6 text-cream shadow-card">
            <p class="text-xs font-semibold uppercase tracking-widest2 text-blush">Custom orders</p>
            <p class="mt-2 text-sm text-cream/75">Ready to create your dream swimsuit? Start your custom journey today.</p>
            <NuxtLink to="/contact" class="mt-4 inline-block rounded-full border border-cream/30 px-5 py-2 text-xs font-semibold uppercase tracking-widest2 hover:bg-cream hover:text-ink">
              Learn more
            </NuxtLink>
          </div>
        </aside>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { categories } from '~/data/products.js'

const GRID_LIMIT = 12 // 4 columns × 3 rows

const tabs = [{ value: 'all', label: 'All' }, ...categories.map((c) => ({ value: c.value, label: c.label }))]
const activeTab = ref('all')

const { data: productData } = await useFetch('/api/products', { key: 'products' })
const allProducts = computed(() => productData.value?.items ?? [])

const visibleProducts = computed(() => {
  const list = activeTab.value === 'all'
    ? allProducts.value
    : allProducts.value.filter((p) => p.category === activeTab.value)
  return list.slice(0, GRID_LIMIT)
})

const steps = [
  { title: 'Choose your style', body: 'Browse the collection or share your dream design with our team.' },
  { title: 'Send your measurements', body: 'Our easy measuring guide makes a perfect, confident fit simple.' },
  { title: 'We craft & ship', body: 'Handmade in the Caribbean and delivered to your door in 2–3 weeks.' }
]

const testimonials = [
  { name: 'Alicia M.', location: "St. George's, Grenada", quote: "I've never felt more confident in a swimsuit. The fit is absolutely perfect — like it was poured onto me." },
  { name: 'Serena K.', location: 'Miami, FL', quote: "This is what swimwear should feel like. Premium, beautiful, and uniquely mine. I've ordered three times now!" },
  { name: 'Tanya R.', location: 'Bridgetown, Barbados', quote: 'The custom design experience was so easy and the result? Absolutely stunning. Island luxury at its finest.' }
]

const lookbook = [
  { kicker: 'Bestsellers', title: 'Cocoa Luxe', gradient: 'bg-gradient-to-br from-ink to-ocean', image: 'https://picsum.photos/seed/bahama-look-1/800/1040' },
  { kicker: 'New In', title: 'Blush Season', gradient: 'bg-gradient-to-br from-blush-deep to-blush', image: 'https://picsum.photos/seed/bahama-look-2/800/1040' },
  { kicker: 'Golden Hour', title: 'Sun-Kissed', gradient: 'bg-gradient-to-br from-coral to-gold', image: 'https://picsum.photos/seed/bahama-look-3/800/1040' },
  { kicker: 'Made for You', title: 'The Custom Edit', gradient: 'bg-gradient-to-br from-ocean-deep to-coral', image: 'https://picsum.photos/seed/bahama-look-4/800/1040' },
  { kicker: 'Resort', title: 'Boardwalk Ready', gradient: 'bg-gradient-to-br from-ink to-blush-deep', image: 'https://picsum.photos/seed/bahama-look-5/800/1040' }
]

const stats = [
  { value: '500+', label: 'Happy customers' },
  { value: '100%', label: 'Made to order' },
  { value: '15+', label: 'Caribbean islands' }
]

const socials = [
  { label: 'Instagram', short: 'IG', href: '#' },
  { label: 'TikTok', short: 'TT', href: '#' },
  { label: 'Pinterest', short: 'Pin', href: '#' }
]

const email = ref('')
const subscribed = ref(false)

const form = reactive({ first: '', last: '', email: '', subject: 'Custom / bespoke design', message: '' })
const sent = ref(false)
</script>
