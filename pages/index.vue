<template>
  <div class="overflow-hidden">
    <!-- Announcement bar -->
    <div class="bg-ink text-center text-[0.7rem] font-semibold uppercase tracking-widest2 text-cream">
      <div class="container-bm py-2.5">All prices in USD. Made for you in {{ MADE_TO_ORDER.turnaround }}</div>
    </div>

    <!-- 1 · HERO -->
    <Hero />

    <!-- 2 · PRODUCT GRID BY CATEGORY -->
    <section id="shop" class="section container-bm">
      <FancyHeading
        eyebrow="The Collection"
        title="Made to be *Worn*"
        center
      >
        From easy staples to pieces that do a little more, find swimwear for
        however you like to show up.
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
          SHOP ALL
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
              Looks Good.<br />Feels Better.
            </p>
          </div>
        </div>

        <div class="py-14 md:py-24 md:pl-14">
          <FancyHeading eyebrow="Custom Swimwear" title="Have *Something Else* in Mind?" />
          <p class="mt-5 max-w-md text-lg leading-relaxed text-ink/70">
            Let's make it. Choose your colours, details and the kind of fit you're
            after, and we'll create a Bahama Mama piece just for you. Each custom
            swimsuit is handmade in Grenada and designed around your measurements
            and vision.
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
            START A CUSTOM ORDER
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
        <FancyHeading eyebrow="The Lookbook" title="A Taste of *Bahama Mama*" center />
      </div>

      <div class="mt-12 flex gap-5 overflow-x-auto scrollbar-hide px-6 pb-4 md:px-10">
        <article
          v-for="(src, i) in lookbook"
          :key="i"
          class="relative aspect-[3/4] w-[76vw] shrink-0 snap-start overflow-hidden rounded-4xl shadow-card sm:w-[46vw] lg:w-[30vw]"
        >
          <img
            :src="src"
            :alt="`Bahama Mama Swimwear lookbook — ${i + 1}`"
            loading="lazy"
            class="absolute inset-0 h-full w-full object-cover"
          />
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
          <FancyHeading eyebrow="Our Story" title="For the Love of *Swimwear*" />
          <p class="mt-5 text-lg leading-relaxed text-ink/75">
            There's a certain feeling that comes with finding a swimsuit you really
            love. One that fits the way you want it to, feels like you, and makes you
            excited to put it on. That feeling is a big part of why Bahama Mama exists.
          </p>
          <p class="mt-4 leading-relaxed text-ink/60">
            Made in Grenada, our swimsuits are for enjoying all the beautiful parts of
            Caribbean life in. Whether you find one you love or dream up something
            completely your own, we want it to feel just right on you.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <NuxtLink to="/about" class="btn-outline">Read our story</NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <BrandPillars />

    <!-- 7 · JOIN EMAIL LIST -->
    <section class="bg-ink">
      <div class="container-bm grid items-center gap-10 py-16 md:grid-cols-2 md:py-20">
        <div>
          <p class="eyebrow text-blush">Stay in the loop</p>
          <h2 class="mt-3 font-display text-4xl font-semibold text-cream md:text-5xl">
            Join our <span class="fancy-accent">Email List</span>
          </h2>
          <p class="mt-4 max-w-md text-cream/70">
            New drops, restocks, custom-order openings and whatever we're working
            on next straight to your inbox.
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
          <p v-if="subscribed" class="mt-3 text-xs text-cream/50">
            You're on the list — see you in your inbox! 🌴
          </p>
        </div>
      </div>
    </section>

    <!-- 8 · CONTACT -->
    <section id="contact" class="section container-bm">
      <FancyHeading eyebrow="Get in Touch" title="Let's *Connect*" center>
        Have questions or just want to say hi? We'd love to hear from you.
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
            Thanks {{ form.first || 'love' }} — your message has been noted, we'll be in touch soon.
          </p>
        </form>

        <aside class="space-y-4">
          <div class="rounded-4xl bg-cream p-6 shadow-card">
            <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Visit Us</p>
            <p class="mt-2 text-sm text-ink/70">St. George, Grenada</p>
          </div>
          <div class="rounded-4xl bg-cream p-6 shadow-card">
            <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Reach Out</p>
            <a href="mailto:hello@bmswimwear.com" class="mt-2 block text-sm text-coral link-underline">hello@bmswimwear.com</a>
          </div>
          <div class="rounded-4xl bg-cream p-6 shadow-card">
            <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Follow Us</p>
            <div class="mt-3 flex gap-2">
              <a
                v-for="s in socials"
                :key="s.label"
                :href="s.href"
                :aria-label="s.label"
                class="grid h-9 w-9 place-items-center rounded-full border border-ink/15 text-ink/70 transition-colors hover:border-coral hover:text-coral"
              >
                <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path :d="s.icon" />
                </svg>
              </a>
            </div>
          </div>
          <div class="rounded-4xl bg-ink p-6 text-cream shadow-card">
            <p class="text-xs font-semibold uppercase tracking-widest2 text-blush">Custom Orders</p>
            <p class="mt-2 text-sm text-cream/75">Ready for a custom swimsuit that fits you like a dream?</p>
            <NuxtLink to="/contact" class="mt-4 inline-block rounded-full border border-cream/30 px-5 py-2 text-xs font-semibold uppercase tracking-widest2 hover:bg-cream hover:text-ink">
              Custom order inquiry
            </NuxtLink>
          </div>
        </aside>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { categories, getProductsByCategory, MADE_TO_ORDER } from '~/data/products.js'

const GRID_LIMIT = 12 // 4 columns × 3 rows

const tabs = [{ value: 'all', label: 'All' }, ...categories.map((c) => ({ value: c.value, label: c.label }))]
const activeTab = ref('all')

const visibleProducts = computed(() => getProductsByCategory(activeTab.value).slice(0, GRID_LIMIT))

const steps = [
  { title: "Tell us what you're thinking", body: 'Send your inspiration, preferred style, colours and any details you have in mind.' },
  { title: 'We design it together', body: "We'll work through the details, fit and finishing touches with you." },
  { title: 'Made for you', body: 'Your piece is cut, sewn and finished by hand in Grenada.' }
]

const testimonials = [
  { name: 'Alicia M.', location: "St. George's, Grenada", quote: "I've never felt more confident in a swimsuit. The fit is absolutely perfect — like it was poured onto me." },
  { name: 'Serena K.', location: 'Miami, FL', quote: "This is what swimwear should feel like. Premium, beautiful, and uniquely mine. I've ordered three times now!" },
  { name: 'Tanya R.', location: 'Bridgetown, Barbados', quote: 'The custom design experience was so easy and the result? Absolutely stunning. Island luxury at its finest.' }
]

const lookbook = Array.from(
  { length: 10 },
  (_, i) => `/images/lookbook/${String(i + 1).padStart(2, '0')}.jpg`
)

const socials = [
  {
    label: 'Instagram',
    href: '#',
    icon: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z'
  },
  {
    label: 'Facebook',
    href: '#',
    icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z'
  },
  {
    label: 'YouTube',
    href: '#',
    icon: 'M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z'
  }
]

const email = ref('')
const subscribed = ref(false)

const form = reactive({ first: '', last: '', email: '', subject: 'Custom / bespoke design', message: '' })
const sent = ref(false)
</script>
