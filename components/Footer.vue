<template>
  <footer class="mt-24 bg-ink text-sand/80">
    <div class="container-bm grid gap-12 py-16 md:grid-cols-4">
      <div class="md:col-span-2">
        <div class="font-display text-2xl font-semibold text-sand">
          Bahama Mama <span class="font-script text-2xl font-normal text-blush">Swimwear</span>
        </div>
        <p class="mt-3 max-w-sm text-sm leading-relaxed text-sand/70">
          Made-to-order and custom swimwear, handcrafted in the Caribbean. Confident, feminine,
          affordable luxury — designed to fit you.
        </p>
        <div class="mt-6 flex gap-3">
          <a
            v-for="s in socials"
            :key="s.label"
            :href="s.href"
            class="grid h-10 w-10 place-items-center rounded-full border border-sand/20 text-sand/80 transition-colors hover:border-coral hover:text-coral"
            :aria-label="s.label"
          >
            <span class="text-xs font-semibold">{{ s.short }}</span>
          </a>
        </div>
      </div>

      <div>
        <div class="eyebrow text-ocean-light">Explore</div>
        <ul class="mt-4 space-y-2 text-sm">
          <li v-for="item in links" :key="item.to">
            <NuxtLink :to="item.to" class="link-underline text-sand/70 hover:text-sand">{{ item.label }}</NuxtLink>
          </li>
        </ul>
      </div>

      <div>
        <div class="eyebrow text-ocean-light">Get in touch</div>
        <ul class="mt-4 space-y-2 text-sm text-sand/70">
          <li><a href="mailto:hello@bahamamamaswim.com" class="link-underline hover:text-sand">hello@bahamamamaswim.com</a></li>
          <li>The Caribbean · Shipping worldwide</li>
          <li>Mon–Fri · 9am–5pm AST</li>
        </ul>
      </div>
    </div>

    <div class="border-t border-sand/10">
      <div class="container-bm flex flex-col items-center justify-between gap-2 py-6 text-xs text-sand/50 md:flex-row">
        <span>© {{ new Date().getFullYear() }} Bahama Mama Swimwear. All rights reserved.</span>
        <span>Handcrafted in the Caribbean 🌊</span>
      </div>
    </div>
  </footer>
</template>

<script setup>
const links = [
  { label: 'Home', to: '/' },
  { label: 'Shop', to: '/shop' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' }
]

const socials = [
  { label: 'Instagram', short: 'IG', href: '#' },
  { label: 'TikTok', short: 'TT', href: '#' },
  { label: 'Pinterest', short: 'Pin', href: '#' }
]
</script>
