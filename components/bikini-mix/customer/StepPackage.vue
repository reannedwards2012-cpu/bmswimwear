<template>
  <div>
    <FancyHeading eyebrow="Step 4" title="Choose Your *Package*" center>
      Both packages include full access to The Bikini Mix experience — pick the one that matches how much you want to
      add.
    </FancyHeading>

    <div class="mx-auto mt-10 grid max-w-3xl gap-6 sm:grid-cols-2">
      <button
        type="button"
        class="group relative flex flex-col rounded-4xl border-2 bg-cream p-7 text-left shadow-card transition-all hover:-translate-y-1"
        :class="modelValue === 'classic_mix' ? 'border-coral' : 'border-transparent'"
        :aria-pressed="modelValue === 'classic_mix'"
        @click="$emit('update:modelValue', 'classic_mix')"
      >
        <span class="eyebrow">Classic Mix</span>
        <p class="mt-2 font-display text-3xl font-semibold text-ink">{{ formatMoney(classicMixPriceXcdCents, 'XCD') }}</p>
        <ul class="mt-5 space-y-2.5 text-sm text-ink/70">
          <li v-for="(line, i) in classicMixInclusions" :key="i" class="flex items-start gap-2">
            <svg viewBox="0 0 24 24" class="mt-0.5 h-4 w-4 shrink-0 text-coral" fill="none" stroke="currentColor" stroke-width="2.4">
              <path d="m5 13 4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {{ line }}
          </li>
        </ul>
        <span
          class="mt-6 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors"
          :class="modelValue === 'classic_mix' ? 'bg-coral text-cream' : 'bg-shell text-ink group-hover:bg-ink group-hover:text-cream'"
        >
          {{ modelValue === 'classic_mix' ? 'Selected' : 'Select Classic Mix' }}
        </span>
      </button>

      <button
        type="button"
        class="group relative flex flex-col rounded-4xl border-2 bg-cream p-7 text-left shadow-card transition-all hover:-translate-y-1"
        :class="modelValue === 'the_works' ? 'border-coral' : 'border-transparent'"
        :aria-pressed="modelValue === 'the_works'"
        @click="$emit('update:modelValue', 'the_works')"
      >
        <span class="absolute -top-3 right-6 rounded-full bg-rose px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-widest2 text-cream shadow-sm">
          The Full Experience
        </span>
        <span class="eyebrow">The Works</span>
        <p class="mt-2 font-display text-3xl font-semibold text-ink">{{ formatMoney(theWorksPriceXcdCents, 'XCD') }}</p>
        <ul class="mt-5 space-y-2.5 text-sm text-ink/70">
          <li v-for="(line, i) in theWorksInclusions" :key="i" class="flex items-start gap-2">
            <svg viewBox="0 0 24 24" class="mt-0.5 h-4 w-4 shrink-0 text-coral" fill="none" stroke="currentColor" stroke-width="2.4">
              <path d="m5 13 4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {{ line }}
          </li>
        </ul>
        <span
          class="mt-6 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors"
          :class="modelValue === 'the_works' ? 'bg-coral text-cream' : 'bg-shell text-ink group-hover:bg-ink group-hover:text-cream'"
        >
          {{ modelValue === 'the_works' ? 'Selected' : 'Select The Works' }}
        </span>
      </button>
    </div>

    <p class="mx-auto mt-6 max-w-md text-center text-xs text-ink/45">
      Straps, beads, charms, transfers and rhinestones are chosen together at the event — you won't need to pick
      those online.
    </p>

    <div v-if="modelValue === 'the_works'" class="mx-auto mt-8 max-w-md rounded-4xl bg-cream p-6 shadow-card sm:p-7">
      <CheckoutField
        label="Name for Your Personalized Packaging"
        :model-value="personalizationName"
        placeholder="The name to put on your bag and trinket"
        required
        @update:model-value="$emit('update:personalizationName', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { formatMoney } from '~/utils/money'

defineProps({
  modelValue: { type: String, default: null },
  classicMixPriceXcdCents: Number,
  classicMixInclusions: { type: Array, default: () => [] },
  theWorksPriceXcdCents: Number,
  theWorksInclusions: { type: Array, default: () => [] },
  personalizationName: { type: String, default: '' }
})
defineEmits(['update:modelValue', 'update:personalizationName'])
</script>
