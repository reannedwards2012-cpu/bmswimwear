<template>
  <div class="flex min-h-screen bg-shell/40">
    <!-- desktop sidebar -->
    <aside class="hidden w-60 shrink-0 flex-col border-r border-ink/10 bg-cream px-5 py-7 lg:flex">
      <AdminSidebarBrand />
      <AdminSidebarNav class="mt-9 flex-1" />
      <AdminSidebarFooter />
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <!-- mobile topbar -->
      <header class="flex items-center justify-between border-b border-ink/10 bg-cream px-5 py-4 lg:hidden">
        <button
          type="button"
          class="grid h-9 w-9 place-items-center rounded-full text-ink transition-colors hover:bg-shell"
          aria-label="Open admin menu"
          :aria-expanded="drawerOpen"
          @click="drawerOpen = true"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round" />
          </svg>
        </button>
        <span class="font-display text-base font-semibold text-ink">Bahama Mama <span class="font-script text-ocean">Admin</span></span>
        <span class="h-9 w-9" aria-hidden="true" />
      </header>

      <main class="flex-1 px-4 py-7 sm:px-6 md:px-8 md:py-9">
        <slot />
      </main>
    </div>

    <!-- mobile drawer -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="drawerOpen"
        class="fixed inset-0 z-[60] bg-ink/40 backdrop-blur-sm lg:hidden"
        @click="drawerOpen = false"
      />
    </Transition>

    <Transition
      enter-active-class="transition-transform duration-250 ease-out"
      enter-from-class="-translate-x-full"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-to-class="-translate-x-full"
    >
      <aside
        v-if="drawerOpen"
        class="fixed left-0 top-0 z-[70] flex h-full w-72 max-w-[80vw] flex-col bg-cream px-5 py-6 shadow-[0_0_80px_-10px_rgba(27,42,47,0.45)] lg:hidden"
        role="dialog"
        aria-label="Admin menu"
      >
        <div class="flex items-center justify-between">
          <AdminSidebarBrand />
          <button
            type="button"
            class="grid h-9 w-9 place-items-center rounded-full text-ink/60 transition-colors hover:bg-shell hover:text-ink"
            aria-label="Close admin menu"
            @click="drawerOpen = false"
          >
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <AdminSidebarNav class="mt-8 flex-1" @navigate="drawerOpen = false" />
        <AdminSidebarFooter />
      </aside>
    </Transition>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'

const drawerOpen = ref(false)
const route = useRoute()

// Close the drawer on any route change (e.g. tapping a sidebar link).
watch(() => route.fullPath, () => {
  drawerOpen.value = false
})

const lockScroll = (on) => {
  if (typeof document !== 'undefined') document.body.style.overflow = on ? 'hidden' : ''
}
watch(drawerOpen, (open) => lockScroll(open))
onBeforeUnmount(() => lockScroll(false))

const onKey = (e) => {
  if (e.key === 'Escape') drawerOpen.value = false
}
if (import.meta.client) {
  window.addEventListener('keydown', onKey)
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
}
</script>
