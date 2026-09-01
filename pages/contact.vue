<template>
  <div>
    <section class="border-b border-ink/10 bg-shell/60">
      <div class="container-bm py-16 md:py-20 text-center">
        <FancyHeading eyebrow="Get in Touch" title="Let's *Connect*" center size="lg">
          Questions about sizing, custom commissions or an existing order? Send us a
          note — we usually reply within one business day.
        </FancyHeading>
      </div>
    </section>

    <section class="section container-bm grid gap-10 md:grid-cols-[1.3fr_1fr]">
      <form class="space-y-4 rounded-4xl bg-cream p-7 shadow-card md:p-9" @submit.prevent="sent = true">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">First name</span>
            <input v-model="form.first" required type="text" class="mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none" />
          </label>
          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Last name</span>
            <input v-model="form.last" type="text" class="mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none" />
          </label>
        </div>
        <label class="block">
          <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Email</span>
          <input v-model="form.email" required type="email" class="mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none" />
        </label>
        <label class="block">
          <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Subject</span>
          <select v-model="form.subject" class="mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none">
            <option>Custom / bespoke design</option>
            <option>Sizing &amp; fit help</option>
            <option>An existing order</option>
            <option>Wholesale</option>
            <option>Just saying hi</option>
          </select>
        </label>
        <label class="block">
          <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Message</span>
          <textarea v-model="form.message" required rows="5" class="mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none"></textarea>
        </label>
        <button type="submit" class="btn-primary w-full shadow-soft">Send message</button>
        <p v-if="sent" class="text-sm text-coral">
          Thanks {{ form.first || 'love' }} — your message has been noted. (Front-end only for now — no
          email is actually sent yet.)
        </p>
      </form>

      <aside class="space-y-4">
        <div class="rounded-4xl bg-cream p-6 shadow-card transition-shadow duration-300 hover:shadow-soft">
          <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Visit Us</p>
          <p class="mt-2 text-sm text-ink/70">St. George, Grenada</p>
        </div>
        <div class="rounded-4xl bg-cream p-6 shadow-card transition-shadow duration-300 hover:shadow-soft">
          <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Reach Out</p>
          <a href="mailto:hello@bmswimwear.com" class="mt-2 block text-sm text-coral link-underline">hello@bmswimwear.com</a>
        </div>
        <div class="rounded-4xl bg-cream p-6 shadow-card transition-shadow duration-300 hover:shadow-soft">
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
        <div class="rounded-4xl bg-ink p-6 text-cream shadow-card transition-shadow duration-300 hover:shadow-soft">
          <p class="text-xs font-semibold uppercase tracking-widest2 text-blush">Made to order</p>
          <p class="mt-2 text-sm text-cream/75">Current turnaround is 2–3 weeks, plus shipping.</p>
          <NuxtLink
            to="/shop"
            class="mt-4 inline-block rounded-full border border-cream/30 px-5 py-2 text-xs font-semibold uppercase tracking-widest2 transition-colors duration-200 hover:bg-cream hover:text-ink"
          >
            Shop now
          </NuxtLink>
        </div>
      </aside>
    </section>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'

const form = reactive({ first: '', last: '', email: '', subject: 'Custom / bespoke design', message: '' })
const sent = ref(false)

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
</script>
