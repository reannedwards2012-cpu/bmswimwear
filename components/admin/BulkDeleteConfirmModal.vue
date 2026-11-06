<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6 backdrop-blur-sm" @click.self="onCancel">
    <div class="w-full max-w-sm rounded-4xl bg-cream p-7 shadow-card">
      <h2 class="font-display text-lg font-semibold text-ink">
        Delete {{ count }} {{ count === 1 ? singularNoun : pluralNoun }}?
      </h2>
      <p class="mt-2 text-sm text-ink/60">
        <slot name="description">
          This will permanently remove the selected {{ count === 1 ? singularNoun : pluralNoun }}. This can’t be undone.
        </slot>
      </p>

      <div v-if="requiresTyped" class="mt-4">
        <label class="block text-xs font-semibold uppercase tracking-widest2 text-ink/60" :for="inputId">
          Type <span class="font-mono font-semibold text-coral">DELETE</span> to confirm
        </label>
        <input
          :id="inputId"
          v-model="typedText"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :disabled="busy"
          class="mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none"
        />
      </div>

      <p v-if="error" class="mt-3 text-xs text-coral">{{ error }}</p>

      <div class="mt-6 flex items-center justify-end gap-3">
        <button type="button" class="btn-outline" :disabled="busy" @click="onCancel">Keep them</button>
        <button
          type="button"
          class="rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-coral/90 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="busy || !canConfirm"
          @click="$emit('confirm')"
        >
          {{ busy ? 'Deleting…' : `Delete ${count}` }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  count: { type: Number, required: true },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
  singularNoun: { type: String, default: 'item' },
  pluralNoun: { type: String, default: 'items' },
  threshold: { type: Number, default: 10 }
})
const emit = defineEmits(['confirm', 'cancel'])

const typedText = ref('')
const inputId = `bulk-delete-confirm-${Math.random().toString(36).slice(2)}`

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) typedText.value = ''
  }
)

const requiresTyped = computed(() => props.count > props.threshold)
const canConfirm = computed(() => !requiresTyped.value || typedText.value === 'DELETE')

function onCancel() {
  if (!props.busy) emit('cancel')
}
</script>
