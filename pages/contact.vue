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
          <ul class="mt-2 space-y-1 text-sm text-ink/70">
            <li><a href="#" class="link-underline">Instagram — @bahamamamaswim</a></li>
            <li><a href="#" class="link-underline">TikTok — @bahamamamaswim</a></li>
          </ul>
        </div>
        <div class="rounded-4xl bg-cream p-6 shadow-card">
          <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Made to order</p>
          <p class="mt-2 text-sm text-ink/70">Current turnaround is 2–3 weeks, plus shipping.</p>
        </div>
      </aside>
    </section>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'

const form = reactive({ first: '', last: '', email: '', subject: 'Custom / bespoke design', message: '' })
const sent = ref(false)
</script>
