<template>
  <div>
    <FancyHeading eyebrow="Step 2" title="Choose Your *Colour Mix*" center>
      Here's where the fun begins! Mix your favourite colours, choose your style and find your fit. We'll prepare
      your bikini pieces ahead of time so everything is ready for you to make it your own.
    </FancyHeading>

    <div class="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
      <!-- preview — the focal point -->
      <div class="flex flex-col items-center gap-4 lg:sticky lg:top-8 lg:w-[22rem] lg:shrink-0">
        <BikiniMixPreview
          :left-colour="leftHex"
          :right-colour="rightHex"
          :left-image-url="leftFabric?.imageUrl || null"
          :right-image-url="rightFabric?.imageUrl || null"
          :bottom-style="modelValue.bottomStyle"
          :bottom-colour="bottomHex"
          :bottom-image-url="bottomFabric?.imageUrl || null"
          :active-component="activeComponent"
          :preview-width="300"
          @select-component="activeComponent = $event"
        />

        <div class="w-full rounded-3xl bg-cream/70 p-4 text-xs text-ink/60">
          <p class="font-semibold uppercase tracking-widest2 text-ink/40">Your combination</p>
          <ul class="mt-2 space-y-1">
            <li>Top — size {{ modelValue.topSize }}, {{ leftFabric?.name || '—' }} / {{ rightFabric?.name || '—' }}</li>
            <li>Bottom — {{ bottomStyleLabel }}, {{ bottomCoverageLabel }} coverage, size {{ modelValue.bottomSize }}, {{ bottomFabric?.name || '—' }}</li>
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

            <!-- Hover (desktop) / tap (mobile) fabric preview — additive only,
                 never interferes with the click-to-select above. -->
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

        <!-- 4. bottom style -->
        <section class="border-t border-ink/10 pt-7">
          <h2 class="font-display text-lg font-semibold text-ink">Bottom Style</h2>
          <div class="mt-4 flex gap-3 sm:gap-4">
            <BikiniMixArtTile
              art-key="tie_front"
              label="Tie-Side"
              :selected="modelValue.bottomStyle === 'tie-side'"
              :width="132"
              @select="update({ bottomStyle: 'tie-side' })"
            />
            <BikiniMixArtTile
              art-key="classic_front"
              label="Classic"
              :selected="modelValue.bottomStyle === 'classic'"
              :width="132"
              @select="update({ bottomStyle: 'classic' })"
            />
          </div>
        </section>

        <!-- 5. bottom coverage -->
        <section class="border-t border-ink/10 pt-7">
          <h2 class="font-display text-lg font-semibold text-ink">Bottom Coverage</h2>
          <div class="mt-4 flex gap-3 sm:gap-4">
            <BikiniMixArtTile
              :art-key="coverageArtKey('bikini')"
              label="Bikini"
              :selected="modelValue.bottomCoverage === 'bikini'"
              :width="132"
              @select="update({ bottomCoverage: 'bikini' })"
            />
            <BikiniMixArtTile
              :art-key="coverageArtKey('cheeky')"
              label="Cheeky"
              :selected="modelValue.bottomCoverage === 'cheeky'"
              :width="132"
              @select="update({ bottomCoverage: 'cheeky' })"
            />
          </div>
          <p class="mt-3 text-[0.7rem] text-ink/40">Shown as the back of the bottom, where the coverage difference actually reads.</p>
        </section>

        <section class="rounded-2xl bg-shell/60 p-4 text-xs leading-relaxed text-ink/55">
          Your bikini base will be prepared using the colours, sizes and styles you choose here, helping us reduce
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
const emit = defineEmits(['update:modelValue'])

const SIZES = ['XS', 'S', 'M', 'L', 'XL']
const sizeGuideOpen = ref(false)
const bottomSizeGuideOpen = ref(false)

function update(patch) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

const fabricById = (id) => props.fabrics.find((f) => f.id === id) ?? null

// Every piece starts on the same default fabric once the palette loads.
watch(
  () => props.fabrics,
  (list) => {
    if (!list.length) return
    const patch = {}
    if (props.modelValue.leftFabricId == null) patch.leftFabricId = list[0].id
    if (props.modelValue.rightFabricId == null) patch.rightFabricId = list[0].id
    if (props.modelValue.bottomFabricId == null) patch.bottomFabricId = list[0].id
    if (Object.keys(patch).length) update(patch)
  },
  { immediate: true }
)

const leftFabric = computed(() => fabricById(props.modelValue.leftFabricId))
const rightFabric = computed(() => fabricById(props.modelValue.rightFabricId))
const bottomFabric = computed(() => fabricById(props.modelValue.bottomFabricId))

const FALLBACK_HEX = '#c9a98a'
const leftHex = computed(() => leftFabric.value?.hexColor || FALLBACK_HEX)
const rightHex = computed(() => rightFabric.value?.hexColor || FALLBACK_HEX)
const bottomHex = computed(() => bottomFabric.value?.hexColor || FALLBACK_HEX)

const activeComponent = ref('left') // 'left' | 'right' | 'bottom'

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
// shortly after since there's no hover to dismiss it on touch. Purely
// additive — never calls preventDefault, so it can't break the existing
// click-to-select behaviour above.
//
// Some mobile browsers fire a synthetic, compatibility `mouseenter` on
// whatever element ends up under the pointer shortly after a tap (iOS
// Safari's hover-emulation quirk) — without the guard below, that stray
// event can silently swap the preview to a neighbouring swatch right after
// a tap already set it correctly. selectAt briefly locks showPreview out so
// a tap's own preview always wins. ──
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

function coverageArtKey(coverage) {
  const prefix = props.modelValue.bottomStyle === 'tie-side' ? 'tie_back' : 'classic_back'
  return `${prefix}_${coverage}`
}
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
