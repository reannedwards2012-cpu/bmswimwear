<template>
  <nav aria-label="Booking progress" class="mx-auto flex max-w-md items-center gap-1.5 sm:gap-2">
    <div v-for="s in STEPS" :key="s.n" class="flex flex-1 flex-col items-center gap-1.5">
      <span
        class="h-1.5 w-full rounded-full transition-colors"
        :class="s.n <= current ? 'bg-coral' : 'bg-ink/10'"
        :aria-current="s.n === current ? 'step' : undefined"
      />
      <span class="hidden text-center text-[0.62rem] font-semibold uppercase tracking-widest2 sm:block" :class="s.n === current ? 'text-coral' : 'text-ink/35'">
        {{ s.label }}
      </span>
    </div>
  </nav>
</template>

<script setup>
defineProps({
  current: { type: Number, required: true }
})

const STEPS = [
  { n: 1, label: 'Invitation' },
  { n: 2, label: 'Build' },
  { n: 3, label: 'Details' },
  { n: 4, label: 'Package' },
  { n: 5, label: 'Review' }
]
</script>
