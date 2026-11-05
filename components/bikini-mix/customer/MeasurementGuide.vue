<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
      @click.self="close"
    >
      <div class="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-cream p-4 shadow-card sm:p-6">
        <button
          ref="closeBtn"
          type="button"
          class="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-ink/90 text-lg text-cream shadow-card transition-colors hover:bg-ink"
          aria-label="Close how-to-measure guide"
          @click="close"
        >
          ✕
        </button>
        <h2 class="sr-only">How to Take Your Measurements</h2>
        <img
          src="/images/bikini-mix/Measurement%20Guide.png"
          alt="How to take your measurements: bust, underbust, waist, and hips, with tips for an accurate self-measurement"
          class="h-auto w-full rounded-2xl object-contain"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

function close() {
  emit('update:modelValue', false)
}

function onKeydown(e) {
  if (e.key === 'Escape') close()
}

const closeBtn = ref(null)
watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      window.addEventListener('keydown', onKeydown)
      await nextTick()
      closeBtn.value?.focus()
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  }
)
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>
