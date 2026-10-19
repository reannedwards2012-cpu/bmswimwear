<template>
  <div class="min-h-screen bg-shell/40 px-4 py-8 sm:px-8 sm:py-12">
    <div class="mx-auto max-w-5xl">
      <p class="text-xs font-semibold uppercase tracking-widest2 text-coral">Internal preview — not part of the live site</p>
      <h1 class="mt-1 font-display text-2xl font-semibold text-ink sm:text-3xl">Bikini Mix — Simulator Prototype</h1>

      <p v-if="fabricsError" class="mt-6 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral">
        Couldn’t load fabrics ({{ fabricsError }}). Sign in as an admin in another tab, then reload this page.
      </p>

      <div v-else class="mt-7 flex flex-col gap-8 lg:flex-row lg:items-start">
        <!-- preview — the focal point: large, above controls on mobile, pinned left on desktop -->
        <div class="flex flex-col items-center gap-4 lg:sticky lg:top-8 lg:w-[21rem] lg:shrink-0">
          <BikiniMixPreview
            :left-colour="leftHex"
            :right-colour="rightHex"
            :bottom-style="bottomStyle"
            :bottom-colour="bottomHex"
            :active-component="activeComponent"
            :preview-width="300"
            @select-component="activeComponent = $event"
          />

          <div class="w-full rounded-3xl bg-cream/70 p-4 text-xs text-ink/60">
            <p class="font-semibold uppercase tracking-widest2 text-ink/40">Your combination</p>
            <ul class="mt-2 space-y-1">
              <li>Top — size {{ topSize }}, {{ leftFabric?.name || '—' }} / {{ rightFabric?.name || '—' }}</li>
              <li>Bottom — {{ bottomStyleLabel }}, {{ bottomCoverageLabel }} coverage, size {{ bottomSize }}, {{ bottomFabric?.name || '—' }}</li>
            </ul>
          </div>
        </div>

        <!-- controls -->
        <div class="flex-1 space-y-8 rounded-4xl bg-cream p-6 shadow-card sm:p-9">
          <!-- 1. top size -->
          <section>
            <div class="flex items-baseline justify-between">
              <h2 class="font-display text-lg font-semibold text-ink">Top Size</h2>
              <button type="button" class="text-xs font-semibold text-coral link-underline" @click="sizeGuideOpen = !sizeGuideOpen">
                {{ sizeGuideOpen ? 'Hide' : 'View' }} size guide
              </button>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                v-for="s in SIZES"
                :key="s"
                type="button"
                class="h-11 w-11 rounded-full border text-sm font-semibold transition-colors"
                :class="topSize === s ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/70 hover:border-ink/40'"
                @click="topSize = s"
              >
                {{ s }}
              </button>
            </div>
            <div v-if="sizeGuideOpen" class="mt-3 rounded-2xl bg-shell/60 p-3 text-xs text-ink/60">
              <p>XS ≈ A cup · S ≈ B cup · M ≈ C cup · L ≈ D cup · XL ≈ DD cup</p>
              <p class="mt-1 text-[0.65rem] text-ink/40">Approximate guidance only, not a universal sizing standard.</p>
            </div>
          </section>

          <!-- 2. colours -->
          <section class="border-t border-ink/10 pt-7">
            <h2 class="font-display text-lg font-semibold text-ink">Customize Your Colours</h2>

            <div class="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              <button
                v-for="c in componentTiles"
                :key="c.key"
                type="button"
                class="flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3.5 text-center transition-colors"
                :class="activeComponent === c.key ? 'border-coral bg-coral/5' : 'border-ink/10 hover:border-ink/25'"
                :aria-pressed="activeComponent === c.key"
                @click="activeComponent = c.key"
              >
                <span class="h-7 w-7 rounded-full border border-ink/10" :style="{ backgroundColor: c.hex }" />
                <span class="text-xs font-semibold" :class="activeComponent === c.key ? 'text-coral' : 'text-ink'">{{ c.label }}</span>
                <span class="truncate text-[0.65rem] text-ink/45">{{ c.name }}</span>
              </button>
            </div>

            <div class="mt-5">
              <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/45">
                Fabric for <span class="text-coral">{{ activeComponentLabel }}</span>
              </p>
              <div class="mt-2.5 flex flex-wrap gap-2">
                <button
                  v-for="f in allFabrics"
                  :key="f.id"
                  type="button"
                  class="flex min-h-11 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors"
                  :class="activeFabricId === f.id ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/70 hover:border-ink/40'"
                  :aria-pressed="activeFabricId === f.id"
                  @click="activeFabricId = f.id"
                >
                  <span
                    class="h-5 w-5 shrink-0 rounded-full border bg-cover bg-center"
                    :class="activeFabricId === f.id ? 'border-cream/40 ring-2 ring-cream/60' : 'border-ink/10'"
                    :style="f.imageUrl ? { backgroundImage: `url(${f.imageUrl})` } : { backgroundColor: f.hexColor }"
                  />
                  {{ f.name }}
                </button>
              </div>
            </div>

            <button type="button" class="mt-4 text-xs font-semibold text-ink/45 underline decoration-dotted underline-offset-2 hover:text-coral" @click="matchAll">
              Match all three to this fabric
            </button>
          </section>

          <!-- 3. bottom style -->
          <section class="border-t border-ink/10 pt-7">
            <h2 class="font-display text-lg font-semibold text-ink">Bottom Style</h2>
            <div class="mt-4 flex gap-3 sm:gap-4">
              <BikiniMixArtTile
                art-key="tie_front"
                label="Tie-Side"
                :selected="bottomStyle === 'tie-side'"
                :width="132"
                @select="bottomStyle = 'tie-side'"
              />
              <BikiniMixArtTile
                art-key="classic_front"
                label="Classic"
                :selected="bottomStyle === 'classic'"
                :width="132"
                @select="bottomStyle = 'classic'"
              />
            </div>
          </section>

          <!-- 4. bottom coverage -->
          <section class="border-t border-ink/10 pt-7">
            <h2 class="font-display text-lg font-semibold text-ink">Bottom Coverage</h2>
            <div class="mt-4 flex gap-3 sm:gap-4">
              <BikiniMixArtTile
                :art-key="coverageArtKey('bikini')"
                label="Bikini"
                :selected="bottomCoverage === 'bikini'"
                :width="132"
                @select="bottomCoverage = 'bikini'"
              />
              <BikiniMixArtTile
                :art-key="coverageArtKey('cheeky')"
                label="Cheeky"
                :selected="bottomCoverage === 'cheeky'"
                :width="132"
                @select="bottomCoverage = 'cheeky'"
              />
            </div>
            <p class="mt-3 text-[0.7rem] text-ink/40">Shown as the back of the bottom, where the coverage difference actually reads.</p>
          </section>

          <!-- 5. bottom size -->
          <section class="border-t border-ink/10 pt-7">
            <h2 class="font-display text-lg font-semibold text-ink">Bottom Size</h2>
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                v-for="s in SIZES"
                :key="s"
                type="button"
                class="h-11 w-11 rounded-full border text-sm font-semibold transition-colors"
                :class="bottomSize === s ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/70 hover:border-ink/40'"
                @click="bottomSize = s"
              >
                {{ s }}
              </button>
            </div>
          </section>

          <section class="rounded-2xl bg-shell/60 p-4 text-xs leading-relaxed text-ink/55">
            Straps, beads, charms and transfers are chosen at the event. Your bikini pieces will be prepared based on
            your booking selections, so please choose carefully — selections are final once payment is completed.
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

definePageMeta({ layout: false, middleware: 'admin' })
useHead({ title: 'Bikini Mix Simulator (dev) — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const { getAccessToken } = useAuth()
async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const SIZES = ['XS', 'S', 'M', 'L', 'XL']

// ── fabrics — see the header comment history: must stay { server: false }
// and un-awaited (matches every other admin page's fetch) so this always
// runs with the browser's real admin session, never during SSR. ──
const { data: fabricsData, error: fabricsFetchError } = useLazyAsyncData(
  'bikini-mix-sim-fabrics',
  () => authedFetch('/api/admin/fabrics'),
  { server: false }
)
const fabricsError = computed(() => {
  const e = fabricsFetchError.value
  if (!e) return null
  const msg = e?.data?.error || e?.message
  return typeof msg === 'string' && msg ? msg : 'Could not load fabrics.'
})
const allFabrics = computed(() =>
  (fabricsData.value?.fabrics ?? []).filter((f) => f.isActive && f.status !== 'unavailable')
)
const fabricById = (id) => allFabrics.value.find((f) => f.id === id) ?? null

// ── selections ──
const topSize = ref('M')
const bottomSize = ref('M')
const sizeGuideOpen = ref(false)

const leftFabricId = ref(null)
const rightFabricId = ref(null)
const bottomFabricId = ref(null)

// Both triangles (and the bottom) start on the same default fabric — spec
// requires this for the triangles; extending it to the bottom too just
// gives a sane, consistent starting look.
watch(
  allFabrics,
  (list) => {
    if (!list.length) return
    if (leftFabricId.value == null) leftFabricId.value = list[0].id
    if (rightFabricId.value == null) rightFabricId.value = list[0].id
    if (bottomFabricId.value == null) bottomFabricId.value = list[0].id
  },
  { immediate: true }
)

const leftFabric = computed(() => fabricById(leftFabricId.value))
const rightFabric = computed(() => fabricById(rightFabricId.value))
const bottomFabric = computed(() => fabricById(bottomFabricId.value))

const FALLBACK_HEX = '#c9a98a'
const leftHex = computed(() => leftFabric.value?.hexColor || FALLBACK_HEX)
const rightHex = computed(() => rightFabric.value?.hexColor || FALLBACK_HEX)
const bottomHex = computed(() => bottomFabric.value?.hexColor || FALLBACK_HEX)

// ── which piece is being customised right now ──
const activeComponent = ref('left') // 'left' | 'right' | 'bottom'

const componentTiles = computed(() => [
  { key: 'left', label: 'Left Triangle', hex: leftHex.value, name: leftFabric.value?.name || '—' },
  { key: 'right', label: 'Right Triangle', hex: rightHex.value, name: rightFabric.value?.name || '—' },
  { key: 'bottom', label: 'Bottom', hex: bottomHex.value, name: bottomFabric.value?.name || '—' }
])
const activeComponentLabel = computed(() => componentTiles.value.find((c) => c.key === activeComponent.value)?.label || '')

// One shared palette, re-pointed at whichever component is active — each
// component keeps its own independent fabric id regardless of which is
// being edited right now.
const activeFabricId = computed({
  get() {
    if (activeComponent.value === 'left') return leftFabricId.value
    if (activeComponent.value === 'right') return rightFabricId.value
    return bottomFabricId.value
  },
  set(id) {
    if (activeComponent.value === 'left') leftFabricId.value = id
    else if (activeComponent.value === 'right') rightFabricId.value = id
    else bottomFabricId.value = id
  }
})

// Secondary action — applies the ACTIVE component's current fabric
// (same fabric id, not just its hex) to all three.
function matchAll() {
  const id = activeFabricId.value
  leftFabricId.value = id
  rightFabricId.value = id
  bottomFabricId.value = id
}

const bottomStyle = ref('tie-side') // 'tie-side' | 'classic'
const bottomCoverage = ref('bikini') // 'bikini' | 'cheeky'

const bottomStyleLabel = computed(() => (bottomStyle.value === 'tie-side' ? 'Tie-Side' : 'Classic'))
const bottomCoverageLabel = computed(() => (bottomCoverage.value === 'cheeky' ? 'Cheeky' : 'Bikini'))

// The coverage tiles illustrate the BACK of whichever bottom style is
// currently selected, so the artwork always matches what the customer
// actually chose.
function coverageArtKey(coverage) {
  const prefix = bottomStyle.value === 'tie-side' ? 'tie_back' : 'classic_back'
  return `${prefix}_${coverage}`
}
</script>
