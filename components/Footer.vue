<template>
  <footer class="mt-24 bg-ink text-sand/80">
    <div class="container-bm grid gap-12 py-16 md:grid-cols-4">
      <div class="md:col-span-2">
        <NuxtLink to="/" class="inline-block" aria-label="Bahama Mama Swimwear — home">
          <img :src="logoSrc" alt="Bahama Mama Swimwear" class="h-14 w-auto select-none" />
        </NuxtLink>
        <p class="mt-4 max-w-sm text-sm leading-relaxed text-sand/70">
          Swimwear made to fit your body, feel like you and go wherever the good days take you.
        </p>
        <div class="mt-6 flex gap-3">
          <a
            v-for="s in socials"
            :key="s.label"
            :href="s.href"
            :aria-label="s.label"
            class="grid h-10 w-10 place-items-center rounded-full border border-sand/20 text-sand/80 transition-colors hover:border-coral hover:text-coral"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path :d="s.icon" />
            </svg>
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
          <li><a href="mailto:hello@bmswimwear.com" class="link-underline hover:text-sand">hello@bmswimwear.com</a></li>
          <li>St. George, Grenada · Shipping worldwide</li>
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
const logoSrc = '/images/bmlogo.png'

const links = [
  { label: 'Home', to: '/' },
  { label: 'Shop', to: '/shop' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' }
]

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
