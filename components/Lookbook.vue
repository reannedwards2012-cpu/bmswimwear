<template>
  <section class="section overflow-hidden bg-shell">
    <FancyHeading eyebrow="The Lookbook" title="A Taste of *Bahama Mama*" center size="sm" />

    <div class="mt-10 md:mt-14">
      <!-- book -->
      <div class="relative mx-auto w-full max-w-[72rem] px-0 sm:px-14">
        <div
          class="relative overflow-hidden rounded-[1.75rem] bg-sand shadow-[0_50px_120px_-40px_rgba(27,42,47,0.5)]"
          @touchstart.passive="startX = $event.touches[0].clientX"
          @touchend.passive="onSwipe($event.changedTouches[0].clientX)"
        >
          <div class="lb-book relative flex aspect-[4/5] sm:aspect-[8/5]">
            <!-- left page -->
            <div class="relative h-full w-full overflow-hidden sm:w-1/2">
              <LookbookPage :page="leftPage" />
              <div class="pointer-events-none absolute inset-y-0 right-0 hidden w-[10%] bg-gradient-to-l from-ink/12 to-transparent sm:block" />
            </div>
            <!-- right page -->
            <div v-if="rightPage" class="relative hidden h-full w-1/2 overflow-hidden sm:block">
              <LookbookPage :page="rightPage" />
              <div class="pointer-events-none absolute inset-y-0 left-0 w-[10%] bg-gradient-to-r from-ink/12 to-transparent" />
            </div>

            <!-- turning leaf -->
            <div
              v-if="flipping"
              class="lb-leaf"
              :class="flipDir === 1 ? 'lb-leaf--next' : 'lb-leaf--prev'"
              @animationend="onFlipEnd"
            >
              <div class="lb-leaf__face">
                <LookbookPage :page="leafFront" />
                <div class="pointer-events-none absolute inset-0 bg-gradient-to-l from-ink/12 via-transparent to-ink/5" />
              </div>
              <div class="lb-leaf__face lb-leaf__face--back">
                <LookbookPage :page="leafBack" />
                <div class="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink/12 via-transparent to-ink/5" />
              </div>
            </div>

            <!-- centre crease -->
            <div class="pointer-events-none absolute inset-y-0 left-1/2 z-20 hidden w-10 -translate-x-1/2 bg-gradient-to-r from-ink/0 via-ink/20 to-ink/0 sm:block" />
            <div class="pointer-events-none absolute inset-y-0 left-1/2 z-20 hidden w-px -translate-x-1/2 bg-ink/15 sm:block" />
          </div>
        </div>

        <button
          type="button"
          aria-label="Previous page"
          class="absolute left-3 top-1/2 z-30 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-cream/90 text-ink shadow-soft backdrop-blur transition duration-200 hover:scale-110 hover:text-coral sm:left-0 sm:bg-cream sm:backdrop-blur-none"
          @click="go(-1)"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Next page"
          class="absolute right-3 top-1/2 z-30 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-cream/90 text-ink shadow-soft backdrop-blur transition duration-200 hover:scale-110 hover:text-coral sm:right-0 sm:bg-cream sm:backdrop-blur-none"
          @click="go(1)"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <!-- counter + progress -->
      <div class="mx-auto mt-7 flex items-center justify-center gap-3 text-[0.7rem] font-semibold tracking-widest2 text-ink/40">
        <span>{{ counter }}</span>
        <span class="relative h-px w-24 bg-ink/15">
          <span class="absolute inset-y-0 left-0 bg-coral transition-all duration-500" :style="{ width: progress + '%' }" />
        </span>
        <span>{{ pad(pages.length) }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'

const L = (n) => `/images/lookbook/${String(n).padStart(2, '0')}.jpg`

// The client supplies 12 pre-composed magazine pages (Pg 01–12); each renders
// full-bleed as one page. Desktop shows two facing pages, mobile one at a time.
const pages = Array.from({ length: 12 }, (_, i) => ({ src: L(i + 1) }))

const n = pages.length
const P_ = (i) => pages[((i % n) + n) % n]

const isWide = ref(false)
const step = computed(() => (isWide.value ? 2 : 1))

const page = ref(0)
const flipping = ref(false)
const flipDir = ref(1)
const startX = ref(0)

const leftPage = computed(() => {
  if (!flipping.value) return P_(page.value)
  if (flipDir.value === -1) return P_(page.value - step.value)
  return isWide.value ? P_(page.value) : P_(page.value + step.value)
})
const rightPage = computed(() => {
  if (!isWide.value) return null
  if (flipping.value && flipDir.value === 1) return P_(page.value + step.value + 1)
  return P_(page.value + 1)
})
const leafFront = computed(() =>
  flipDir.value === 1 ? P_(page.value + (isWide.value ? 1 : 0)) : P_(page.value)
)
const leafBack = computed(() =>
  flipDir.value === 1 ? P_(page.value + step.value) : P_(page.value - 1)
)

const pad = (v) => String(v).padStart(2, '0')
const counter = computed(() => {
  const l = ((page.value % n) + n) % n
  return isWide.value ? `${pad(l + 1)}–${pad(((l + 1) % n) + 1)}` : pad(l + 1)
})
const progress = computed(() => ((((page.value % n) + n) % n) + 1) / n * 100)

function go(d) {
  if (flipping.value) return
  flipDir.value = d
  flipping.value = true
}
function onFlipEnd() {
  page.value = (((page.value + flipDir.value * step.value) % n) + n) % n
  flipping.value = false
}
function onSwipe(endX) {
  const dx = endX - startX.value
  if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
}
function onKey(e) {
  if (e.key === 'ArrowLeft') go(-1)
  else if (e.key === 'ArrowRight') go(1)
}

let mq
let io
let onMq
onMounted(() => {
  mq = window.matchMedia('(min-width: 640px)')
  isWide.value = mq.matches
  onMq = (e) => {
    isWide.value = e.matches
  }
  mq.addEventListener('change', onMq)

  io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) window.addEventListener('keydown', onKey)
      else window.removeEventListener('keydown', onKey)
    },
    { threshold: 0.35 }
  )
  const el = document.querySelector('.lb-book')
  if (el) io.observe(el)
})

onBeforeUnmount(() => {
  mq?.removeEventListener('change', onMq)
  io?.disconnect()
  window.removeEventListener('keydown', onKey)
})
</script>
