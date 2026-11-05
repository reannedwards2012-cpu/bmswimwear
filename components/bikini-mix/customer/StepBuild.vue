<template>
  <div>
    <FancyHeading eyebrow="Step 2" title="Build Your *Swimsuit*" center>
      Start by choosing your silhouette, then mix your colours and find your fit. We'll prepare your pieces ahead of
      time so everything is ready for you to make it your own.
    </FancyHeading>

    <!-- garment type — nothing below renders until one is chosen -->
    <div class="mx-auto mt-8 grid max-w-xl gap-4 sm:grid-cols-2">
      <button
        type="button"
        class="flex flex-col items-center gap-2 rounded-4xl border-2 bg-cream px-6 py-8 text-center shadow-card transition-all hover:-translate-y-0.5"
        :class="modelValue.garmentType === 'bikini' ? 'border-coral' : 'border-transparent'"
        :aria-pressed="modelValue.garmentType === 'bikini'"
        @click="$emit('set-garment-type', 'bikini')"
      >
        <span class="font-display text-xl font-semibold text-ink">Bikini</span>
        <span class="text-xs text-ink/50">Top, bottom style, coverage &amp; scrunch</span>
      </button>
      <button
        type="button"
        class="flex flex-col items-center gap-2 rounded-4xl border-2 bg-cream px-6 py-8 text-center shadow-card transition-all hover:-translate-y-0.5"
        :class="modelValue.garmentType === 'onepiece' ? 'border-coral' : 'border-transparent'"
        :aria-pressed="modelValue.garmentType === 'onepiece'"
        @click="$emit('set-garment-type', 'onepiece')"
      >
        <span class="font-display text-xl font-semibold text-ink">One-Piece</span>
        <span class="text-xs text-ink/50">One fabric, your coverage</span>
      </button>
    </div>

    <div v-if="modelValue.garmentType" class="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
      <!-- preview — the focal point -->
      <div class="flex flex-col items-center gap-4 lg:sticky lg:top-8 lg:w-[22rem] lg:shrink-0">
        <BikiniMixPreview
          :garment-type="modelValue.garmentType"
          :left-colour="leftHex"
          :right-colour="rightHex"
          :left-image-url="leftFabric?.imageUrl || null"
          :right-image-url="rightFabric?.imageUrl || null"
          :bottom-style="modelValue.bottomStyle"
          :bottom-colour="bottomHex"
          :bottom-image-url="bottomFabric?.imageUrl || null"
          :bottom-coverage="modelValue.bottomCoverage"
          :bottom-scrunch="modelValue.bottomScrunch"
          :onepiece-colour="onepieceHex"
          :onepiece-image-url="onepieceFabric?.imageUrl || null"
          :onepiece-coverage="modelValue.onepieceCoverage"
          :active-component="activeComponent"
          :preview-width="300"
          :show-flip="false"
          @select-component="activeComponent = $event"
        />

        <div class="w-full rounded-3xl bg-cream/70 p-4 text-xs text-ink/60">
          <p class="font-semibold uppercase tracking-widest2 text-ink/40">Your combination</p>
          <ul v-if="modelValue.garmentType === 'bikini'" class="mt-2 space-y-1">
            <li>Top — size {{ modelValue.topSize }}, {{ leftFabric?.name || '—' }} / {{ rightFabric?.name || '—' }}</li>
            <li v-if="topComplete">Bottom — {{ bottomStyleLabel }}, {{ bottomCoverageLabel }} coverage{{ modelValue.bottomScrunch ? ', scrunch' : '' }}, size {{ modelValue.bottomSize }}, {{ bottomFabric?.name || '—' }}</li>
            <li v-else class="text-ink/40">Bottom style &amp; size — choose your top colours first</li>
          </ul>
          <ul v-else class="mt-2 space-y-1">
            <li>Size {{ modelValue.onepieceSize }}, {{ onepieceCoverageLabel }} coverage, {{ onepieceFabric?.name || '—' }}</li>
          </ul>
        </div>

        <button
          type="button"
          class="text-xs font-semibold text-ink/45 underline decoration-dotted underline-offset-4 hover:text-coral"
          @click="$emit('open-gallery')"
        >
          See What You Can Customize →
        </button>
      </div>

      <!-- controls -->
      <div class="flex-1 space-y-8 rounded-4xl bg-cream p-6 shadow-card sm:p-9">
        <template v-if="modelValue.garmentType === 'bikini'">
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
                :class="modelValue.topSize === s ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/70 hover:border-ink/40'"
                @click="update({ topSize: s })"
              >
                {{ s }}
              </button>
            </div>
            <div v-if="sizeGuideOpen" class="mt-3 rounded-2xl bg-shell/60 p-3 text-xs text-ink/60">
              <p>XS ≈ A cup · S ≈ B cup · M ≈ C cup · L ≈ D cup · XL ≈ DD cup</p>
              <p class="mt-1 text-[0.65rem] text-ink/40">Approximate guidance only, not a universal sizing standard.</p>
            </div>
          </section>

          <!-- 2. all three colours together, visible from the start -->
          <section class="border-t border-ink/10 pt-7">
            <h2 class="font-display text-lg font-semibold text-ink">Choose Your Colors</h2>

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
                  v-for="f in fabrics"
                  :key="f.id"
                  type="button"
                  class="flex min-h-11 items-center gap-2 rounded-full border px-3.5 py-2.5 text-xs font-medium transition-colors"
                  :class="activeFabricId === f.id ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/70 hover:border-ink/40'"
                  :aria-pressed="activeFabricId === f.id"
                  @click="selectFabric(f)"
                  @mouseenter="showPreview(f.id)"
                  @mouseleave="hidePreview(f.id)"
                >
                  <span
                    class="h-5 w-5 shrink-0 rounded-full border bg-cover bg-center"
                    :class="activeFabricId === f.id ? 'border-ink/20 ring-2 ring-coral/70' : 'border-ink/10'"
                    :style="f.imageUrl ? { backgroundImage: `url(${f.imageUrl})` } : { backgroundColor: f.hexColor }"
                  />
                  {{ f.name }}
                </button>
              </div>

              <transition name="fade-preview">
                <div v-if="previewFabric" class="mt-3 flex items-center gap-3 rounded-2xl border border-ink/10 bg-cream p-3 shadow-card">
                  <span
                    class="h-16 w-16 shrink-0 rounded-xl border border-ink/10 bg-cover bg-center"
                    :style="previewFabric.imageUrl ? { backgroundImage: `url(${previewFabric.imageUrl})` } : { backgroundColor: previewFabric.hexColor }"
                  />
                  <div>
                    <p class="text-sm font-semibold text-ink">{{ previewFabric.name }}</p>
                    <p class="text-[0.65rem] uppercase tracking-widest2 text-ink/40">
                      {{ previewFabric.imageUrl ? 'Printed fabric' : 'Solid colour' }}
                    </p>
                  </div>
                </div>
              </transition>
            </div>

            <button type="button" class="mt-4 text-xs font-semibold text-ink/45 underline decoration-dotted underline-offset-2 hover:text-coral" @click="matchAll">
              Match all three to this fabric
            </button>
          </section>

          <!-- everything below is revealed only once the top colours are chosen -->
          <template v-if="topComplete">
            <!-- 3. bottom size -->
            <section class="border-t border-ink/10 pt-7">
              <div class="flex items-baseline justify-between">
                <h2 class="font-display text-lg font-semibold text-ink">Bottom Size</h2>
                <button
                  v-if="bottomSizeGuide.length"
                  type="button"
                  class="text-xs font-semibold text-coral link-underline"
                  @click="bottomSizeGuideOpen = !bottomSizeGuideOpen"
                >
                  {{ bottomSizeGuideOpen ? 'Hide' : 'View' }} size guide
                </button>
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <button
                  v-for="s in SIZES"
                  :key="s"
                  type="button"
                  class="h-11 w-11 rounded-full border text-sm font-semibold transition-colors"
                  :class="modelValue.bottomSize === s ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/70 hover:border-ink/40'"
                  @click="update({ bottomSize: s })"
                >
                  {{ s }}
                </button>
              </div>
              <div v-if="bottomSizeGuideOpen && bottomSizeGuide.length" class="mt-3 rounded-2xl bg-shell/60 p-3 text-xs text-ink/60">
                <div class="overflow-x-auto">
                  <table class="w-full min-w-[20rem] text-left">
                    <thead>
                      <tr class="text-[0.65rem] font-semibold uppercase tracking-widest2 text-ink/40">
                        <th class="py-1 pr-3">Size</th>
                        <th class="py-1 pr-3">Waist (in)</th>
                        <th class="py-1">Hip (in)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in bottomSizeGuide" :key="row.size">
                        <td class="py-1 pr-3 font-semibold text-ink">{{ row.size }}</td>
                        <td class="py-1 pr-3">{{ row.waist || '—' }}</td>
                        <td class="py-1">{{ row.hip || '—' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p class="mt-2 text-[0.65rem] text-ink/40">
                  If your waist and hip measurements fall into different sizes, we recommend choosing based on your hip
                  measurement.
                </p>
              </div>
            </section>

            <!-- 4. style, coverage & scrunch — one condensed section of compact segmented controls -->
            <section class="border-t border-ink/10 pt-6">
              <h2 class="font-display text-base font-semibold text-ink">Customize Your Bottom</h2>

              <div class="mt-3 divide-y divide-ink/10">
                <div class="flex items-center justify-between gap-3 py-2.5">
                  <span class="text-xs font-semibold text-ink/55">Style</span>
                  <div class="inline-flex rounded-full bg-shell/60 p-1">
                    <button
                      type="button"
                      class="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors"
                      :class="modelValue.bottomStyle === 'tie-side' ? 'bg-ink text-cream' : 'text-ink/60 hover:text-ink'"
                      :aria-pressed="modelValue.bottomStyle === 'tie-side'"
                      @click="update({ bottomStyle: 'tie-side' })"
                    >
                      Tie-side
                    </button>
                    <button
                      type="button"
                      class="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors"
                      :class="modelValue.bottomStyle === 'classic' ? 'bg-ink text-cream' : 'text-ink/60 hover:text-ink'"
                      :aria-pressed="modelValue.bottomStyle === 'classic'"
                      @click="update({ bottomStyle: 'classic' })"
                    >
                      Classic
                    </button>
                  </div>
                </div>

                <div class="flex items-center justify-between gap-3 py-2.5">
                  <span class="text-xs font-semibold text-ink/55">Coverage</span>
                  <div class="inline-flex rounded-full bg-shell/60 p-1">
                    <button
                      type="button"
                      class="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors"
                      :class="modelValue.bottomCoverage === 'bikini' ? 'bg-ink text-cream' : 'text-ink/60 hover:text-ink'"
                      :aria-pressed="modelValue.bottomCoverage === 'bikini'"
                      @click="update({ bottomCoverage: 'bikini' })"
                    >
                      Bikini
                    </button>
                    <button
                      type="button"
                      class="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors"
                      :class="modelValue.bottomCoverage === 'cheeky' ? 'bg-ink text-cream' : 'text-ink/60 hover:text-ink'"
                      :aria-pressed="modelValue.bottomCoverage === 'cheeky'"
                      @click="update({ bottomCoverage: 'cheeky' })"
                    >
                      Cheeky
                    </button>
                  </div>
                </div>

                <div class="flex items-center justify-between gap-3 py-2.5">
                  <span class="text-xs font-semibold text-ink/55">Scrunch</span>
                  <div class="inline-flex rounded-full bg-shell/60 p-1">
                    <button
                      type="button"
                      class="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors"
                      :class="!modelValue.bottomScrunch ? 'bg-ink text-cream' : 'text-ink/60 hover:text-ink'"
                      :aria-pressed="!modelValue.bottomScrunch"
                      @click="update({ bottomScrunch: false })"
                    >
                      No
                    </button>
                    <button
                      type="button"
                      class="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors"
                      :class="modelValue.bottomScrunch ? 'bg-ink text-cream' : 'text-ink/60 hover:text-ink'"
                      :aria-pressed="modelValue.bottomScrunch"
                      @click="update({ bottomScrunch: true })"
                    >
                      Yes
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </template>
        </template>

        <template v-else>
          <!-- one-piece: 1. size -->
          <section>
            <h2 class="font-display text-lg font-semibold text-ink">Size</h2>
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                v-for="s in SIZES"
                :key="s"
                type="button"
                class="h-11 w-11 rounded-full border text-sm font-semibold transition-colors"
                :class="modelValue.onepieceSize === s ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/70 hover:border-ink/40'"
                @click="update({ onepieceSize: s })"
              >
                {{ s }}
              </button>
            </div>
          </section>

          <!-- one-piece: 2. coverage -->
          <section class="border-t border-ink/10 pt-7">
            <BikiniMixCustomerCoverageSelect
              heading="Coverage"
              :model-value="modelValue.onepieceCoverage"
              @update:model-value="update({ onepieceCoverage: $event })"
            />
          </section>

          <!-- one-piece: 3. fabric — only fabrics opted in for one-pieces -->
          <section class="border-t border-ink/10 pt-7">
            <h2 class="font-display text-lg font-semibold text-ink">Fabric &amp; Colour</h2>
            <p v-if="!onepieceFabrics.length" class="mt-2 text-xs text-ink/45">
              No fabrics are currently marked eligible for one-pieces — check back soon, or ask us directly.
            </p>
            <div v-else class="mt-3 flex flex-wrap gap-2">
              <button
                v-for="f in onepieceFabrics"
                :key="f.id"
                type="button"
                class="flex min-h-11 items-center gap-2 rounded-full border px-3.5 py-2.5 text-xs font-medium transition-colors"
                :class="modelValue.onepieceFabricId === f.id ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/70 hover:border-ink/40'"
                :aria-pressed="modelValue.onepieceFabricId === f.id"
                @click="update({ onepieceFabricId: f.id })"
              >
                <span
                  class="h-5 w-5 shrink-0 rounded-full border bg-cover bg-center"
                  :class="modelValue.onepieceFabricId === f.id ? 'border-ink/20 ring-2 ring-coral/70' : 'border-ink/10'"
                  :style="f.imageUrl ? { backgroundImage: `url(${f.imageUrl})` } : { backgroundColor: f.hexColor }"
                />
                {{ f.name }}
              </button>
            </div>
          </section>
        </template>

        <section class="rounded-2xl bg-shell/60 p-4 text-xs leading-relaxed text-ink/55">
          Your swimsuit base will be prepared using the colours, sizes and styles you choose here, helping us reduce
          fabric waste. You'll get to choose your straps, beads, charms and other extras at the event. Please select
          carefully, as your base selections are final once payment is completed. Swaps may be possible on the day
          if extra pieces are available.
        </section>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Object, required: true },
  fabrics: { type: Array, default: () => [] },
  bottomSizeGuide: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue', 'set-garment-type', 'open-gallery'])

const SIZES = ['XS', 'S', 'M', 'L', 'XL']
const sizeGuideOpen = ref(false)
const bottomSizeGuideOpen = ref(false)

function update(patch) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

const fabricById = (id) => props.fabrics.find((f) => f.id === id) ?? null
const onepieceFabrics = computed(() => props.fabrics.filter((f) => f.eligibleForOnepiece))

// Top is "complete" once both triangle colours are chosen (size always has
// a default) — this gates revealing the Bottom Size / Customize Your Bottom
// sections below, so the bikini builder discloses itself progressively
// instead of showing every field at once. Bottom colour itself is NOT
// gated — it's chosen upfront alongside left/right, in the same "Choose
// Your Colors" section.
const topComplete = computed(() => Boolean(props.modelValue.topSize && props.modelValue.leftFabricId && props.modelValue.rightFabricId))

// Nothing is pre-selected for the customer — every fabric choice (top
// triangles, bottom, one-piece) is deliberate, never silently defaulted to
// "the first fabric in the list". Only the one-piece fabric still defaults
// once eligible fabrics exist, since there's exactly one zone to fill
// there and no progressive-disclosure gate depends on it staying empty.
watch(
  () => [props.fabrics, props.modelValue.garmentType],
  () => {
    if (!props.fabrics.length) return
    if (props.modelValue.garmentType === 'onepiece' && props.modelValue.onepieceFabricId == null && onepieceFabrics.value.length) {
      update({ onepieceFabricId: onepieceFabrics.value[0].id })
    }
  },
  { immediate: true }
)

const leftFabric = computed(() => fabricById(props.modelValue.leftFabricId))
const rightFabric = computed(() => fabricById(props.modelValue.rightFabricId))
const bottomFabric = computed(() => fabricById(props.modelValue.bottomFabricId))
const onepieceFabric = computed(() => fabricById(props.modelValue.onepieceFabricId))

const FALLBACK_HEX = '#c9a98a'
const leftHex = computed(() => leftFabric.value?.hexColor || FALLBACK_HEX)
const rightHex = computed(() => rightFabric.value?.hexColor || FALLBACK_HEX)
const bottomHex = computed(() => bottomFabric.value?.hexColor || FALLBACK_HEX)
const onepieceHex = computed(() => onepieceFabric.value?.hexColor || FALLBACK_HEX)

const activeComponent = ref('left') // 'left' | 'right' | 'bottom' | 'onepiece'
watch(
  () => props.modelValue.garmentType,
  (type) => {
    activeComponent.value = type === 'onepiece' ? 'onepiece' : 'left'
  }
)

const componentTiles = computed(() => [
  { key: 'left', label: 'Left Triangle', hex: leftHex.value, name: leftFabric.value?.name || '—' },
  { key: 'right', label: 'Right Triangle', hex: rightHex.value, name: rightFabric.value?.name || '—' },
  { key: 'bottom', label: 'Bottom', hex: bottomHex.value, name: bottomFabric.value?.name || '—' }
])
const activeComponentLabel = computed(() => componentTiles.value.find((c) => c.key === activeComponent.value)?.label || '')

const activeFabricId = computed({
  get() {
    if (activeComponent.value === 'left') return props.modelValue.leftFabricId
    if (activeComponent.value === 'right') return props.modelValue.rightFabricId
    return props.modelValue.bottomFabricId
  },
  set(id) {
    if (activeComponent.value === 'left') update({ leftFabricId: id })
    else if (activeComponent.value === 'right') update({ rightFabricId: id })
    else update({ bottomFabricId: id })
  }
})

function matchAll() {
  const id = activeFabricId.value
  update({ leftFabricId: id, rightFabricId: id, bottomFabricId: id })
}

// ── Fabric preview: desktop hover shows it instantly; mobile tap selects
// the fabric exactly as before AND shows the same preview, auto-hiding
// shortly after since there's no hover to dismiss it on touch.
const previewFabricId = ref(null)
let previewTimer = null
let selectedAt = 0
const previewFabric = computed(() => fabricById(previewFabricId.value))

function showPreview(id) {
  if (Date.now() - selectedAt < 500) return
  previewFabricId.value = id
}
function hidePreview(id) {
  if (previewFabricId.value === id) previewFabricId.value = null
}
function selectFabric(f) {
  activeFabricId.value = f.id
  previewFabricId.value = f.id
  selectedAt = Date.now()
  clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    if (previewFabricId.value === f.id) previewFabricId.value = null
  }, 2200)
}
onBeforeUnmount(() => clearTimeout(previewTimer))

const bottomStyleLabel = computed(() => (props.modelValue.bottomStyle === 'tie-side' ? 'Tie-Side' : 'Classic'))
const bottomCoverageLabel = computed(() => (props.modelValue.bottomCoverage === 'cheeky' ? 'Cheeky' : 'Bikini'))
const onepieceCoverageLabel = computed(() => (props.modelValue.onepieceCoverage === 'cheeky' ? 'Cheeky' : 'Bikini'))
</script>

<style scoped>
.fade-preview-enter-active,
.fade-preview-leave-active {
  transition: opacity 150ms ease;
}
.fade-preview-enter-from,
.fade-preview-leave-to {
  opacity: 0;
}
</style>
