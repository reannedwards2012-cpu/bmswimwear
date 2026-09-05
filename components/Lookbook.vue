<template>
  <section class="section overflow-hidden bg-shell">
    <FancyHeading eyebrow="The Lookbook" title="A Taste of *Bahama Mama*" center />

    <div class="mt-10 md:mt-14">
      <!-- book, with a static "page stack" frame suggesting paper depth at rest -->
      <div class="relative mx-auto w-full max-w-[72rem] px-0 sm:px-14">
        <div class="relative mx-auto" :style="{ maxWidth: '68rem' }">
          <!-- stacked-paper edges peeking from behind the top spread -->
          <div
            class="pointer-events-none absolute inset-x-3 -bottom-2 top-3 hidden rounded-[1.5rem] bg-sand/70 shadow-soft sm:block"
            aria-hidden="true"
          />
          <div
            class="pointer-events-none absolute inset-x-1.5 -bottom-1 top-1.5 hidden rounded-[1.6rem] bg-sand/85 shadow-soft sm:block"
            aria-hidden="true"
          />

          <ClientOnly>
            <!-- bookHost: the real, correctly-sized viewport (matches the
                 visible footprint exactly). bookScale is sized dpr× larger
                 and scaled back down by 1/dpr, so page-flip — which always
                 renders its canvas at 1 canvas-pixel-per-CSS-pixel with no
                 Retina awareness of its own — measures and renders against
                 the larger box, producing a supersampled, sharp result that
                 lands back at the same on-screen size. -->
            <div
              ref="bookHost"
              class="relative mx-auto overflow-hidden rounded-[1.75rem] bg-sand shadow-[0_50px_120px_-40px_rgba(27,42,47,0.5)]"
              :style="{ aspectRatio: hostAspect, width: '100%' }"
            >
              <div
                ref="bookScale"
                class="absolute left-0 top-0 origin-top-left"
                :style="{ width: dpr * 100 + '%', height: dpr * 100 + '%', transform: `scale(${1 / dpr})` }"
              >
                <div ref="bookEl" class="lb-flipbook h-full w-full" />
              </div>
            </div>

            <template #fallback>
              <div
                class="relative mx-auto aspect-[4/5] w-full max-w-[26rem] overflow-hidden rounded-[1.75rem] bg-sand shadow-[0_50px_120px_-40px_rgba(27,42,47,0.5)] sm:aspect-[8/5] sm:max-w-none"
              >
                <img :src="pages[0].src" alt="" class="h-full w-full object-cover" />
              </div>
            </template>
          </ClientOnly>
        </div>

        <button
          type="button"
          aria-label="Previous page"
          class="absolute left-3 top-1/2 z-30 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-cream/90 text-ink shadow-soft backdrop-blur transition duration-200 hover:scale-110 hover:text-coral disabled:pointer-events-none disabled:opacity-30 sm:left-0 sm:bg-cream sm:backdrop-blur-none"
          :disabled="!canGoPrev"
          @click="goPrev"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Next page"
          class="absolute right-3 top-1/2 z-30 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-cream/90 text-ink shadow-soft backdrop-blur transition duration-200 hover:scale-110 hover:text-coral disabled:pointer-events-none disabled:opacity-30 sm:right-0 sm:bg-cream sm:backdrop-blur-none"
          :disabled="!canGoNext"
          @click="goNext"
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
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

const L = (n) => `/images/lookbook/${String(n).padStart(2, '0')}.jpg`

// The client supplies 14 pre-composed magazine pages (Pg 01–14); each renders
// full-bleed as one page. StPageFlip (see below) handles the single-page
// (portrait) vs. facing-pages (landscape) layout itself.
const pages = Array.from({ length: 14 }, (_, i) => ({ src: L(i + 1) }))
const n = pages.length

const bookHost = ref(null)
const bookScale = ref(null)
const bookEl = ref(null)
const pageFlip = shallowRef(null)

// Supersampling factor for the canvas page-flip renders at (see the
// bookHost/bookScale wrapper in the template) — capped at 3x so a very
// high-DPR phone doesn't demand an excessive canvas. Stays 1 (safe, no
// scaling) until the client-only mount code sets the real value.
const dpr = ref(1)
// Best-effort guess so the very first paint is already the right shape —
// corrected for real once page-flip reports its own orientation.
const orientation = ref('landscape') // 'portrait' | 'landscape'
const hostAspect = computed(() => (orientation.value === 'portrait' ? '4 / 5' : '8 / 5'))

// Set as early as possible on the client (before the template's first
// render) so bookHost/bookScale are sized correctly from the start, not
// corrected after a flash. window.innerWidth is a best guess at the
// portrait/landscape split — page-flip's own `changeOrientation` event
// (below) corrects orientation for real if this guess was wrong.
if (import.meta.client) {
  dpr.value = Math.min(window.devicePixelRatio || 1, 3)
  orientation.value = window.innerWidth < 640 ? 'portrait' : 'landscape'
}

const currentIndex = ref(0) // 0-based, from the library
const pageCountReady = ref(n)
const isFlipping = ref(false)
const isWrapping = ref(false)
// Set only while a loop-wrap flip is in flight, so the completion handler
// knows how to interpret the (temporarily padded) index it lands on.
const wrapDirection = ref(null) // 'forward' | 'backward' | null

// In landscape (facing-pages) mode the library advances by 2 page indices
// per turn, not 1 — used below to land wraparound on a proper spread start.
const step = computed(() => (orientation.value === 'portrait' ? 1 : 2))
const atStart = computed(() => currentIndex.value <= 0)
const atEnd = computed(() => currentIndex.value + step.value >= pageCountReady.value)
// Infinite loop: the book wraps at either end, so the buttons are only ever
// disabled mid-flip, never at a boundary.
const canGoPrev = computed(() => !isFlipping.value && !isWrapping.value)
const canGoNext = computed(() => !isFlipping.value && !isWrapping.value)

const pad = (v) => String(v).padStart(2, '0')
const counter = computed(() => {
  const i = currentIndex.value
  if (orientation.value === 'portrait') return pad(i + 1)
  // Facing pages: an even index is a left page showing i/i+1; an odd index
  // (can happen on the very first/last single page) just shows itself.
  const left = i % 2 === 0 ? i : i - 1
  const right = Math.min(left + 1, n - 1)
  return `${pad(left + 1)}–${pad(right + 1)}`
})
const progress = computed(() => ((currentIndex.value + 1) / pageCountReady.value) * 100)

function goPrev() {
  const flip = pageFlip.value
  if (!flip || isWrapping.value) return
  if (atStart.value) wrapBackward(flip)
  else flip.flipPrev()
}
function goNext() {
  const flip = pageFlip.value
  if (!flip || isWrapping.value) return
  if (atEnd.value) wrapForward(flip)
  else flip.flipNext()
}

// Looping the animation direction, not just the destination.
//
// StPageFlip's flip(page) picks forward/backward purely by comparing the
// target page number to the current one — so flipping from the last spread
// (a high index) to the first (0) always computes as "backward", which is
// the exact bug we're fixing: Next must always animate forward, even when
// wrapping, and Prev must always animate backward.
//
// flipNext()/flipPrev() themselves always animate in the direction their
// name implies (the direction is which method you call, not a page-number
// comparison) — but they refuse to move past a real boundary, because
// there's genuinely no further page in the loaded set. So: temporarily
// extend the loaded set with a clone of the page(s) being wrapped to,
// positioned on the correct numeric side of the current page, flip onto
// that clone (a completely normal, correctly-directed flip since it's just
// "the next real page" as far as the library is concerned), then once
// landed, snap invisibly back to the true index and restore the original
// (unpadded) image set. The clone is pixel-identical to the real page it
// stands in for, so the swap is imperceptible.
function wrapForward(flip) {
  isWrapping.value = true
  // NOTE: updateFromImages()/turnToPage() below are the *instant* (non
  // animated) methods, but they still fire a 'flip' event synchronously as
  // a side effect of resetting position — so wrapDirection must stay null
  // through all of this setup, or the completion handler fires on this
  // instant repositioning instead of the real animated flip. It's only set
  // right before the actual flip() call, which is the one method that
  // fires 'flip' exactly once, at genuine completion.
  const clone = pages.slice(0, step.value).map((p) => p.src)
  const at = flip.getCurrentPageIndex()
  flip.updateFromImages([...pages.map((p) => p.src), ...clone])
  flip.turnToPage(at) // append-only, so the current index doesn't shift
  requestAnimationFrame(() => {
    wrapDirection.value = 'forward'
    flip.flip(n) // n is numerically ahead -> forward
  })
}
function wrapBackward(flip) {
  isWrapping.value = true
  const cloneCount = step.value
  const clone = pages.slice(n - cloneCount).map((p) => p.src)
  flip.updateFromImages([...clone, ...pages.map((p) => p.src)])
  flip.turnToPage(cloneCount) // true page 0 now sits at index `cloneCount`
  requestAnimationFrame(() => {
    wrapDirection.value = 'backward'
    flip.flip(0) // 0 is numerically behind -> backward
  })
}
function onKey(e) {
  if (e.key === 'ArrowLeft') goPrev()
  else if (e.key === 'ArrowRight') goNext()
}

// Hand-rolled swipe + edge-click, standing in for StPageFlip's native
// pointer handling (disabled above — see useMouseEvents:false). Listens on
// bookHost, the outer, correctly-sized/untransformed element, so its
// coordinates need no DPR/transform math at all: a real horizontal drag
// turns a page (mirroring the "optional swipe" mobile gesture); a plain
// tap/click near either edge also turns a page (mirroring the corner-click
// affordance the library would otherwise provide). A tap/click in the
// middle (normal reading area) does nothing, same as before.
function attachGestures(el) {
  let startX = 0
  let startY = 0
  let tracking = false
  const SWIPE_THRESHOLD = 40

  const down = (x, y) => {
    startX = x
    startY = y
    tracking = true
  }
  const up = (x, y) => {
    if (!tracking) return
    tracking = false
    const dx = x - startX
    const dy = y - startY
    // A deliberate horizontal drag — dominant over any vertical movement,
    // so an up/down scroll attempt on mobile is never mistaken for a swipe.
    if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext()
      else goPrev()
      return
    }
    // Otherwise, a near-stationary tap/click close to either edge.
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {
      const rect = el.getBoundingClientRect()
      const relX = (x - rect.left) / rect.width
      if (relX < 0.12) goPrev()
      else if (relX > 0.88) goNext()
    }
  }

  const onTouchStart = (e) => {
    if (e.touches.length === 1) down(e.touches[0].clientX, e.touches[0].clientY)
  }
  const onTouchEnd = (e) => up(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
  const onMouseDown = (e) => down(e.clientX, e.clientY)
  const onMouseUp = (e) => up(e.clientX, e.clientY)

  el.addEventListener('touchstart', onTouchStart, { passive: true })
  el.addEventListener('touchend', onTouchEnd, { passive: true })
  el.addEventListener('mousedown', onMouseDown)
  el.addEventListener('mouseup', onMouseUp)

  return () => {
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchend', onTouchEnd)
    el.removeEventListener('mousedown', onMouseDown)
    el.removeEventListener('mouseup', onMouseUp)
  }
}

let io
let detachGestures

// `bookEl` sits inside <ClientOnly>, whose slot content mounts a tick after
// this component's own onMounted fires — watching for the ref to actually
// appear is what's reliable here, not onMounted itself.
watch(
  bookEl,
  async (el) => {
    if (!el) return

    const { PageFlip } = await import('page-flip')

    // Read once at mount — flippingTime is a construction-time setting, and
    // a reduced-motion preference changing mid-visit is rare enough that a
    // full rebuild isn't worth the complexity.
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // page-flip always renders its canvas at exactly 1 canvas-pixel per
    // CSS-pixel — no Retina awareness of its own. bookScale (see template)
    // gives it a `dpr`×-larger box to measure and render against, so these
    // bounds need to scale right along with it, or they'd clamp the render
    // back down to a soft, non-supersampled size.
    const scale = (px) => Math.round(px * dpr.value)
    const flip = new PageFlip(el, {
      width: scale(480),
      height: scale(600),
      size: 'stretch',
      minWidth: scale(260),
      maxWidth: scale(760),
      minHeight: scale(325),
      maxHeight: scale(950),
      // A real page turn takes long enough to see it travel and fold, but
      // brisk and energetic rather than languid. Reduced-motion gets a much
      // quicker, simpler cut instead of the full dramatic turn.
      flippingTime: prefersReducedMotion ? 120 : 700,
      usePortrait: true,
      maxShadowOpacity: 0.75,
      showCover: false,
      // Keeps normal page scrolling working for touch users — the lookbook
      // sits inside a long scrolling homepage, so only a deliberate
      // horizontal swipe should turn a page, never a vertical scroll attempt.
      mobileScrollSupport: true,
      // The library's own corner-click / drag hit-testing (getMousePos, via
      // a transform-aware getBoundingClientRect) is measured against the
      // untransformed layout size (offsetWidth) internally — a mismatch the
      // dpr scale-down above introduces, which makes native pointer
      // handling silently miss every click/drag. Disabled here in favour of
      // the hand-rolled, transform-independent gesture layer below
      // (attachGestures), which drives the same goNext()/goPrev() the
      // buttons use and isn't affected by the mismatch.
      useMouseEvents: false
    })

    // Fast first paint: load just enough pages for the initial view, then
    // fetch the rest in the background and fold them in once cached —
    // avoids pulling all 12 images up front for a homepage section that may
    // never be fully paged through.
    const FIRST_BATCH = 4
    flip.loadFromImages(pages.slice(0, FIRST_BATCH).map((p) => p.src))
    pageFlip.value = flip

    pageCountReady.value = flip.getPageCount()
    orientation.value = flip.getOrientation?.() ?? orientation.value

    flip.on('flip', () => {
      // turnToPage()/updateFromImages() below each re-fire this same 'flip'
      // event synchronously (StPageFlip triggers it from inside
      // updatePageIndex()) — clear the wrap flag FIRST so that re-entrant
      // call sees a plain, non-wrapping state and just falls through to the
      // normal branch, instead of recursing into itself infinitely.
      if (wrapDirection.value === 'forward') {
        wrapDirection.value = null
        isWrapping.value = false
        // Landed on the trailing clone (index n) — snap invisibly to the
        // true start and drop the temporary padding.
        flip.turnToPage(0)
        flip.updateFromImages(pages.map((p) => p.src))
        flip.turnToPage(0)
        currentIndex.value = 0
        return
      }
      if (wrapDirection.value === 'backward') {
        wrapDirection.value = null
        isWrapping.value = false
        // Landed on the leading clone — drop the padding and snap to the
        // true last spread.
        flip.updateFromImages(pages.map((p) => p.src))
        const lastStart = n - step.value
        flip.turnToPage(lastStart)
        currentIndex.value = lastStart
        return
      }
      currentIndex.value = flip.getCurrentPageIndex()
    })
    flip.on('changeState', (e) => {
      isFlipping.value = e.data === 'flipping'
    })
    flip.on('changeOrientation', (e) => {
      orientation.value = e.data
    })

    const preloadRest = () => {
      const rest = pages.slice(FIRST_BATCH)
      if (!rest.length) return
      Promise.all(
        rest.map(
          (p) =>
            new Promise((resolve) => {
              const img = new Image()
              img.onload = resolve
              img.onerror = resolve
              img.src = p.src
            })
        )
      ).then(() => {
        // A loop-wrap (see wrapForward/wrapBackward) briefly loads its own
        // padded image set and restores the full unpadded set when it
        // finishes — skip here if one is in flight to avoid two concurrent
        // updateFromImages calls; the wrap's own restore already ends up
        // loading every image anyway (each was already cached by the
        // Promise.all above), so nothing is lost by skipping.
        if (isWrapping.value) return
        const at = flip.getCurrentPageIndex()
        flip.updateFromImages(pages.map((p) => p.src))
        pageCountReady.value = flip.getPageCount()
        flip.turnToPage(at)
      })
    }
    if ('requestIdleCallback' in window) window.requestIdleCallback(preloadRest, { timeout: 4000 })
    else setTimeout(preloadRest, 1500)

    io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) window.addEventListener('keydown', onKey)
        else window.removeEventListener('keydown', onKey)
      },
      { threshold: 0.35 }
    )
    io.observe(el)

    if (bookHost.value) detachGestures = attachGestures(bookHost.value)
  },
  { once: true }
)

onBeforeUnmount(() => {
  pageFlip.value?.destroy()
  io?.disconnect()
  detachGestures?.()
  window.removeEventListener('keydown', onKey)
})
</script>
