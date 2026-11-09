<template>
  <Teleport to="body">
    <Transition name="lb-backdrop">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-6"
        role="dialog"
        aria-modal="true"
        :aria-label="current?.caption ? `${current.caption} — image ${displayIndex + 1} of ${images.length}` : `Gallery image ${displayIndex + 1} of ${images.length}`"
        @click.self="close"
      >
        <button
          ref="closeBtn"
          type="button"
          class="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-5 sm:top-5"
          aria-label="Close gallery"
          @click="close"
        >
          ✕
        </button>

        <button
          v-if="images.length > 1"
          type="button"
          class="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-5"
          aria-label="Previous image"
          @click="prev"
        >
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <button
          v-if="images.length > 1"
          type="button"
          class="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-5"
          aria-label="Next image"
          @click="next"
        >
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>

        <div
          class="flex max-h-full w-full max-w-4xl flex-col items-center gap-3"
          @touchstart.passive="onTouchStart"
          @touchend.passive="onTouchEnd"
        >
          <Transition name="lb-fade" mode="out-in">
            <img
              :key="current?.id"
              :src="current?.imageUrl"
              :alt="current?.caption || 'Swimsuit Mixer customization photo'"
              class="max-h-[76vh] w-auto max-w-full select-none rounded-2xl object-contain shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
              @click.stop
            />
          </Transition>
          <div class="flex flex-wrap items-center justify-center gap-3 px-2 text-center text-xs text-white/75">
            <span v-if="current?.caption">{{ current.caption }}</span>
            <span class="rounded-full bg-white/10 px-2.5 py-1 text-[0.65rem] font-semibold tracking-widest2">{{ displayIndex + 1 }} / {{ images.length }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

/**
 * Full-screen image viewer shared by the "Get Inspired" gallery section and
 * StepBuild's quick-reference link — one implementation, one set of
 * keyboard/swipe/focus rules, used from two different entry points.
 *
 * openIndex is intentionally NOT clamped by the parent — prev()/next() can
 * emit a value outside [0, images.length), and displayIndex below wraps it
 * with modulo, so the gallery loops in both directions without the parent
 * needing to know the wrap logic.
 */
const props = defineProps({
  images: { type: Array, default: () => [] },
  openIndex: { type: Number, default: null }
})
const emit = defineEmits(['update:openIndex'])

const isOpen = computed(() => props.openIndex != null && props.images.length > 0)
const displayIndex = computed(() => {
  if (!isOpen.value) return 0
  const n = props.images.length
  return ((props.openIndex % n) + n) % n
})
const current = computed(() => props.images[displayIndex.value] || null)

function close() {
  emit('update:openIndex', null)
}
function prev() {
  emit('update:openIndex', displayIndex.value - 1)
}
function next() {
  emit('update:openIndex', displayIndex.value + 1)
}

function onKeydown(e) {
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowLeft') prev()
  else if (e.key === 'ArrowRight') next()
}

const closeBtn = ref(null)
// immediate: true so a component that's already open on its first render
// (e.g. the page restoring a lightbox index) still gets its keydown
// listener and scroll lock attached — not just on a later false→true
// transition. This runs during SSR too (setup() executes on the server),
// where `window`/`document` don't exist at all — guarded below so this
// never throws there; the real listener/lock attachment only ever matters
// client-side anyway.
watch(isOpen, async (open) => {
  if (typeof window === 'undefined') return
  if (open) {
    window.addEventListener('keydown', onKeydown)
    document.body.style.overflow = 'hidden'
    await nextTick()
    closeBtn.value?.focus()
  } else {
    window.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
}, { immediate: true })
onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})

// Mobile swipe navigation — a deliberate horizontal drag only, so a normal
// vertical scroll attempt (the backdrop itself doesn't scroll, but a thumb
// drag could still start vertically) is never mistaken for a swipe.
let startX = 0
let startY = 0
const SWIPE_THRESHOLD = 40
function onTouchStart(e) {
  if (e.touches.length !== 1) return
  startX = e.touches[0].clientX
  startY = e.touches[0].clientY
}
function onTouchEnd(e) {
  const touch = e.changedTouches[0]
  if (!touch) return
  const dx = touch.clientX - startX
  const dy = touch.clientY - startY
  if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) next()
    else prev()
  }
}
</script>

<style scoped>
.lb-backdrop-enter-active,
.lb-backdrop-leave-active {
  transition: opacity 180ms ease;
}
.lb-backdrop-enter-from,
.lb-backdrop-leave-to {
  opacity: 0;
}
.lb-fade-enter-active,
.lb-fade-leave-active {
  transition: opacity 160ms ease;
}
.lb-fade-enter-from,
.lb-fade-leave-to {
  opacity: 0;
}
</style>
