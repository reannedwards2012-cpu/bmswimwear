<template>
  <div class="rounded-3xl border border-ink/10 p-5">
    <h3 class="font-display text-base font-semibold text-ink">{{ label }}</h3>
    <label class="mt-3 block">
      <span class="lbl">Price (EC$)</span>
      <input
        :value="price"
        type="number"
        min="0"
        step="0.01"
        class="inp"
        @input="$emit('update:price', $event.target.value)"
      />
    </label>

    <div class="mt-4">
      <span class="lbl">Inclusions</span>
      <ul class="mt-1.5 space-y-1.5">
        <li v-for="(line, i) in inclusions" :key="i" class="flex items-center gap-2 text-sm text-ink/70">
          <span class="flex-1 rounded-xl bg-shell/60 px-3 py-1.5">{{ line }}</span>
          <button type="button" class="text-ink/35 hover:text-coral" @click="removeLine(i)">✕</button>
        </li>
      </ul>
      <div class="mt-2 flex gap-2">
        <input v-model.trim="draft" type="text" placeholder="e.g. 6 beads" class="inp flex-1 !mt-0" @keydown.enter.prevent="addLine" />
        <button type="button" class="btn-outline px-4 py-1.5 text-xs" @click="addLine">Add</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  price: { type: String, default: '' },
  inclusions: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:price', 'update:inclusions'])

const draft = ref('')
function addLine() {
  const v = draft.value.trim()
  if (!v) return
  emit('update:inclusions', [...props.inclusions, v])
  draft.value = ''
}
function removeLine(i) {
  emit('update:inclusions', props.inclusions.filter((_, idx) => idx !== i))
}
</script>

<style scoped>
.lbl {
  @apply text-xs font-semibold uppercase tracking-widest2 text-ink/60;
}
.inp {
  @apply mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none;
}
</style>
