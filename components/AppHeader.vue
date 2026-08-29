<template>
  <header
    class="sticky top-0 z-50 border-b transition-colors duration-300"
    :class="scrolled ? 'border-ink/10 bg-sand/90 backdrop-blur' : 'border-transparent bg-sand'"
  >
    <div class="container-bm flex h-20 items-center justify-between">
      <BrandLogo />

      <nav class="hidden items-center gap-9 md:flex">
        <NuxtLink
          v-for="item in links"
          :key="item.to"
          :to="item.to"
          class="link-underline text-sm font-medium text-ink/80 hover:text-ink"
          active-class="text-ink after:w-full"
        >
          {{ item.label }}
        </NuxtLink>
        <NuxtLink to="/shop" class="btn-dark !px-6 !py-2.5">Shop now</NuxtLink>
      </nav>

      <button
        class="grid h-10 w-10 place-items-center rounded-full text-ink md:hidden"
        :aria-expanded="open"
        aria-label="Toggle menu"
        @click="open = !open"
      >
        <svg v-if="!open" viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round" />
        </svg>
        <svg v-else viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="-translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="-translate-y-2 opacity-0"
    >
      <nav v-if="open" class="border-t border-ink/10 bg-sand md:hidden">
        <div class="container-bm flex flex-col py-4">
          <NuxtLink
            v-for="item in links"
            :key="item.to"
            :to="item.to"
            class="border-b border-ink/5 py-3 text-sm font-medium text-ink/80"
            active-class="text-ink"
            @click="open = false"
          >
            {{ item.label }}
          </NuxtLink>
          <NuxtLink to="/shop" class="btn-dark mt-4" @click="open = false">Shop now</NuxtLink>
        </div>
      </nav>
    </Transition>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const links = [
  { label: 'Home', to: '/' },
  { label: 'Shop', to: '/shop' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' }
]

const open = ref(false)
const scrolled = ref(false)

const onScroll = () => {
  scrolled.value = window.scrollY > 8
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>
