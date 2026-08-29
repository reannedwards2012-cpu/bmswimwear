<template>
  <div>
    <section class="border-b border-ink/10 bg-shell/50">
      <div class="container-bm py-16 md:py-20">
        <p class="eyebrow">Contact</p>
        <h1 class="mt-3 font-display text-4xl font-semibold text-ink md:text-5xl">Let's talk swimwear</h1>
        <p class="mt-4 max-w-xl text-lg leading-relaxed text-ink/65">
          Questions about sizing, custom commissions or an existing order? Send us a note — we
          usually reply within one business day.
        </p>
      </div>
    </section>

    <section class="container-bm grid gap-14 py-16 md:grid-cols-[1.2fr_1fr] md:py-24">
      <form class="space-y-5" @submit.prevent="sent = true">
        <div class="grid gap-5 sm:grid-cols-2">
          <label class="block">
            <span class="text-sm font-medium text-ink">Name</span>
            <input
              v-model="form.name"
              required
              type="text"
              class="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm text-ink focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
            />
          </label>
          <label class="block">
            <span class="text-sm font-medium text-ink">Email</span>
            <input
              v-model="form.email"
              required
              type="email"
              class="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm text-ink focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
            />
          </label>
        </div>
        <label class="block">
          <span class="text-sm font-medium text-ink">Subject</span>
          <select
            v-model="form.subject"
            class="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm text-ink focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
          >
            <option>General enquiry</option>
            <option>Custom / bespoke design</option>
            <option>Sizing &amp; fit help</option>
            <option>Existing order</option>
            <option>Wholesale</option>
          </select>
        </label>
        <label class="block">
          <span class="text-sm font-medium text-ink">Message</span>
          <textarea
            v-model="form.message"
            required
            rows="5"
            class="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm text-ink focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
          ></textarea>
        </label>
        <button type="submit" class="btn-primary">Send message</button>
        <p v-if="sent" class="text-sm text-ocean">
          Thanks {{ form.name || 'there' }} — your message has been noted. (Front-end only for now — no
          email is actually sent yet.)
        </p>
      </form>

      <aside class="space-y-8">
        <div>
          <div class="eyebrow">Email</div>
          <a href="mailto:hello@bahamamamaswim.com" class="mt-2 block text-ink link-underline">hello@bahamamamaswim.com</a>
        </div>
        <div>
          <div class="eyebrow">Social</div>
          <ul class="mt-2 space-y-1 text-ink/75">
            <li><a href="#" class="link-underline">Instagram — @bahamamamaswim</a></li>
            <li><a href="#" class="link-underline">TikTok — @bahamamamaswim</a></li>
          </ul>
        </div>
        <div>
          <div class="eyebrow">Studio hours</div>
          <p class="mt-2 text-ink/75">Monday – Friday<br />9:00am – 5:00pm AST</p>
        </div>
        <div>
          <div class="eyebrow">Made to order</div>
          <p class="mt-2 text-ink/75">Current turnaround is 2–3 weeks, plus shipping.</p>
        </div>
      </aside>
    </section>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'

const form = reactive({ name: '', email: '', subject: 'General enquiry', message: '' })
const sent = ref(false)
</script>
