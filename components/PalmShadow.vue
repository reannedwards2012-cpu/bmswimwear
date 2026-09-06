<template>
  <!--
    Decorative only. The soft shadow a coconut-palm frond (or a small crown
    of them) casts in tropical sunlight — feathered leaflets, gently drooping,
    blurred, low opacity. Purely presentational: pointer-events:none,
    aria-hidden, sits behind content.

    Colour is the site's own `ink` (dark ink backgrounds get a faint warm
    `sand` shape instead) at a few % opacity — no new palette is introduced.

    Needs a positioned ancestor to sit against. It is happy to spill past its
    wrapper — clip it only at a *real* outer edge (e.g. the hero `<section>`'s
    own `overflow-hidden`), never at an internal panel boundary, or the cast
    shadow reads as a rectangle. Usual pattern:

      <section class="relative isolate overflow-hidden ...">
        <div class="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <PalmShadow position="top-right" tone="dark" size="lg" />
        </div>
        …content…
      </section>
  -->
  <span
    class="palm-shadow pointer-events-none absolute block select-none"
    :class="[posClass, sizeClass, toneClass, blurClass]"
    aria-hidden="true"
  >
    <svg
      :viewBox="viewBox"
      class="h-full w-full overflow-visible"
      preserveAspectRatio="xMidYMid meet"
      :style="{ transform: `rotate(${rotation}deg)${flip ? ' scaleX(-1)' : ''}` }"
      focusable="false"
      aria-hidden="true"
    >
      <g v-for="(f, fi) in fronds" :key="fi" :transform="f.transform" fill="currentColor">
        <!-- the rachis: a tapering filled limb (wide at the base, down to a
             point) for the hero, a simple hairline stroke everywhere else -->
        <path v-if="f.ribFill" :d="f.ribFill" />
        <path
          v-else
          :d="f.stem"
          fill="none"
          stroke="currentColor"
          :stroke-width="ribWidth"
          stroke-linecap="round"
        />
        <path v-for="(d, i) in f.leaflets" :key="i" :d="d" />
      </g>
    </svg>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // where it enters from — also sets a natural rotation so repeated use
  // across the site doesn't look stamped
  position: {
    type: String,
    default: 'top-right',
    validator: (v) => ['top-right', 'top-left', 'bottom-right', 'bottom-left', 'left', 'right', 'hero'].includes(v)
  },
  // 'dark'  → faint ink shape (for light backgrounds)
  // 'light' → faint warm-sand shape (for dark ink backgrounds)
  tone: { type: String, default: 'dark', validator: (v) => ['dark', 'light'].includes(v) },
  size: { type: String, default: 'md', validator: (v) => ['sm', 'md', 'lg', 'xl'].includes(v) },
  // a small crown of fronds fanning from one point (a coconut-palm top)
  cluster: { type: Boolean, default: false },
  flip: { type: Boolean, default: false }
})

// ── one coconut-palm frond ────────────────────────────────────────────────
// Feathered leaflets are drawn as slim, pointed blades (filled almond shapes)
// off a curved rachis. A tiny seeded PRNG adds per-leaflet length/angle
// variation so the frond looks grown, not combed — and, being deterministic,
// it renders identically on the server and the client (no hydration mismatch).
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildFrond({
  seed,
  P0,
  P1,
  P2,
  N = 34,
  lenBase = 18,
  lenSpan = 98,
  bellExp = 0.6,
  droopK = 0.17,
  splay = 0.3, // radians the leaflet sits back from square-on to the rachis
  splaySweep = 0, // >0 sweeps leaflets back near the base and forward toward the tip
  widthK = 0.05,
  lenJit = 0.16,
  angJit = 0.11,
  tipBias = 0, // >0 pushes the longest leaflets past the middle toward the tip
  tipTaper = 0, // 0..1 — extra linear narrowing from base to a fine point at the tip
  ribW0 = 0 // >0 draws the rachis as a filled limb this wide at the base, tapering to a point
}) {
  const rnd = mulberry32(seed)
  const jit = (amt) => (rnd() * 2 - 1) * amt

  const at = (t) => {
    const u = 1 - t
    return [u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0], u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1]]
  }
  const tan = (t) => {
    const u = 1 - t
    return [2 * u * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]), 2 * u * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1])]
  }
  const stem = `M${P0[0]},${P0[1]} Q${P1[0]},${P1[1]} ${P2[0]},${P2[1]}`

  // optional tapered filled rachis — one edge, then back down the other
  let ribFill = null
  if (ribW0 > 0) {
    const steps = 26
    const left = []
    const right = []
    for (let i = 0; i <= steps; i++) {
      const tt = i / steps
      const [cx, cy] = at(tt)
      const [dx2, dy2] = tan(tt)
      const mag = Math.hypot(dx2, dy2) || 1
      const nx2 = -dy2 / mag
      const ny2 = dx2 / mag
      const w = ribW0 * Math.pow(1 - tt, 1.15) + 0.35 // wide at base → ~0 at tip
      left.push([cx + nx2 * w, cy + ny2 * w])
      right.push([cx - nx2 * w, cy - ny2 * w])
    }
    const pts = left.concat(right.reverse())
    ribFill = 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L') + 'Z'
  }

  const leaflets = []
  for (let k = 1; k < N; k++) {
    const t = k / N
    const [px, py] = at(t)
    const [tx, ty] = tan(t)
    const a = Math.atan2(ty, tx)
    const bell = Math.pow(Math.sin(Math.PI * t), bellExp) // 0 at both ends, 1 mid-frond
    const skew = 1 - tipBias * (0.5 - t)
    const len = (lenBase + lenSpan * bell) * skew * (1 - tipTaper * t) * (1 + jit(lenJit))
    const halfW = len * (widthK + 0.022 * bell)
    const effSplay = splay + splaySweep * (t - 0.45)
    for (const s of [-1, 1]) {
      // off the rachis, swept back near the base and forward toward the tip
      const ang = a - s * (Math.PI / 2 - effSplay) + jit(angJit)
      const dx = Math.cos(ang)
      const dy = Math.sin(ang)
      const nx = -Math.sin(ang) // unit normal, for blade width
      const ny = Math.cos(ang)
      const droop = droopK * len // gravity pull toward the ground
      const tipx = px + dx * len
      const tipy = py + dy * len + droop
      const m = 0.42 // blade is widest a little before halfway
      const mx = px + dx * len * m
      const my = py + dy * len * m + droop * m
      // almond blade: pointed where it meets the rachis and at the tip
      leaflets.push(
        `M${px.toFixed(1)},${py.toFixed(1)} ` +
          `Q${(mx + nx * halfW).toFixed(1)},${(my + ny * halfW).toFixed(1)} ${tipx.toFixed(1)},${tipy.toFixed(1)} ` +
          `Q${(mx - nx * halfW).toFixed(1)},${(my - ny * halfW).toFixed(1)} ${px.toFixed(1)},${py.toFixed(1)}Z`
      )
    }
  }
  return { stem, ribFill, leaflets }
}

// footer / newsletter: one frond, viewBox 0 0 300 300 (base bottom-left)
const DEFAULT_RACHIS = { P0: [28, 286], P1: [122, 84], P2: [292, 82] }
const SINGLE = [{ transform: '', ...buildFrond({ seed: 7, ...DEFAULT_RACHIS }) }]

// a small crown of fronds fanning from the base — each gets its own seed so
// the crown isn't three identical copies
const CLUSTER = [
  { transform: 'rotate(-31 28 286) scale(1.05)', ...buildFrond({ seed: 11, ...DEFAULT_RACHIS }) },
  { transform: 'rotate(-9 28 286)', ...buildFrond({ seed: 23, ...DEFAULT_RACHIS }) },
  { transform: 'rotate(15 28 286) scale(0.86)', ...buildFrond({ seed: 41, ...DEFAULT_RACHIS }) }
]

// hero text panel: TWO coconut-frond limbs hanging from a crown just past the
// top-right corner (the tree is off-frame there). Each is drawn in near-final
// orientation — attach point at the top-right, the rachis arcing LEFT while it
// DROOPS DOWN — and each is a proper tapered limb: a filled rachis that is wide
// where it leaves the crown and narrows to a point, with leaflets that are
// long near the base and shorten to a fine feathered tip. Both fronds' tips
// finish well inside the panel; the section's own overflow-hidden only ever
// clips the wide base at the corner, never the tapered ends.
const HERO_VB = '0 0 510 400'
const heroFrondBase = {
  N: 48,
  lenBase: 18,
  lenSpan: 172,
  bellExp: 0.36,
  droopK: 0.19,
  splay: 0.34,
  splaySweep: 0.5, // leaflets sweep back at the base, forward at the tip → a flowing frond
  widthK: 0.052,
  lenJit: 0.17,
  angJit: 0.12,
  tipTaper: 0.66, // strong narrowing → a fine point at the very end
  ribW0: 9 // filled rachis, wide where it leaves the crown, down to a point
}
const HERO_FRONDS = [
  {
    // outer limb — sweeps in nearly level from past the top-right corner, then
    // arcs over and DOWN, tapering to a point out around the headline
    transform: '',
    ...buildFrond({ seed: 7, P0: [500, 40], P1: [300, 26], P2: [74, 236], ...heroFrondBase })
  },
  {
    // inner limb — from the same crown but hangs STEEPER, a deeper curve, its
    // point finishing lower and well clear of the first one
    transform: '',
    ...buildFrond({
      seed: 23,
      P0: [478, 24],
      P1: [430, 66],
      P2: [224, 332],
      ...heroFrondBase,
      lenSpan: 154,
      droopK: 0.17
    })
  }
]

const isHero = computed(() => props.position === 'hero')
const viewBox = computed(() => (isHero.value ? HERO_VB : '0 0 300 300'))
const ribWidth = computed(() => (isHero.value ? 3.4 : 2))
const fronds = computed(() => (isHero.value ? HERO_FRONDS : props.cluster ? CLUSTER : SINGLE))

const POS = {
  'top-right': { cls: '-top-16 -right-14 sm:-top-24 sm:-right-24', rot: 206 },
  'top-left': { cls: '-top-16 -left-14 sm:-top-24 sm:-left-24', rot: 30 },
  'bottom-right': { cls: '-bottom-24 -right-20 sm:-bottom-32 sm:-right-28', rot: 322 },
  'bottom-left': { cls: '-bottom-24 -left-24 sm:-bottom-32 sm:-left-32', rot: 66 },
  left: { cls: 'top-1/2 -left-24 -translate-y-1/2 sm:-left-36', rot: 128 },
  right: { cls: '-top-8 -right-28 sm:-top-10 sm:-right-40', rot: 236 },
  // hero: the frond hangs in from just past the top-right corner. On mobile it
  // stays tucked into the panel's top-right; on desktop it sweeps down-left
  // across the upper negative space and is clipped only by the section edge.
  hero: {
    cls: '-top-14 -right-10 sm:-top-16 sm:-right-14 lg:-top-16 lg:-right-24 xl:-top-20 xl:-right-28 2xl:-top-24 2xl:-right-36',
    rot: -4
  }
}
const posClass = computed(() => (POS[props.position] || POS['top-right']).cls)
const rotation = computed(() => (POS[props.position] || POS['top-right']).rot)

const SIZE = {
  sm: 'h-52 w-52 sm:h-72 sm:w-72',
  md: 'h-64 w-64 sm:h-[24rem] sm:w-[24rem]',
  lg: 'h-[19rem] w-[19rem] sm:h-[32rem] sm:w-[32rem] lg:h-[40rem] lg:w-[40rem]',
  xl: 'h-[24rem] w-[24rem] sm:h-[40rem] sm:w-[40rem] lg:h-[52rem] lg:w-[52rem]',
  // hero span roughly matches the two-frond viewBox ratio so it isn't squashed;
  // kept in check at lg so the tapered tips stay clear of the photo, fuller above
  hero:
    'h-[20rem] w-[25rem] sm:h-[24rem] sm:w-[31rem] lg:h-[34rem] lg:w-[43rem] xl:h-[39rem] xl:w-[49rem] 2xl:h-[43rem] 2xl:w-[55rem]'
}
const sizeClass = computed(() => (isHero.value ? SIZE.hero : SIZE[props.size] || SIZE.md))

// existing brand colours only — visibly a shadow, but still soft. The hero
// frond is large, so it is kept a touch softer/fainter to stay a cast shadow.
const toneClass = computed(() => {
  if (props.tone === 'light') return 'text-sand opacity-[0.08] sm:opacity-[0.1]'
  return isHero.value ? 'text-ink opacity-[0.08] sm:opacity-[0.11]' : 'text-ink opacity-[0.09] sm:opacity-[0.12]'
})
// soft + natural, but defined enough to read as palm leaflets; lighter on mobile
const blurClass = computed(() => (isHero.value ? 'blur-[2.5px] sm:blur-[5px]' : 'blur-[2px] sm:blur-[3.5px]'))
</script>
