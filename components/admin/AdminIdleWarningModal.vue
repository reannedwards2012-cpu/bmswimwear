<template>
  <div v-if="warning.show" class="fixed inset-0 z-[80] flex items-center justify-center bg-ink/40 p-6 backdrop-blur-sm">
    <div class="w-full max-w-sm rounded-4xl bg-cream p-7 shadow-card" role="alertdialog" aria-labelledby="admin-idle-warning-title">
      <h2 id="admin-idle-warning-title" class="font-display text-lg font-semibold text-ink">
        Still there?
      </h2>
      <p class="mt-2 text-sm text-ink/60">
        You’ll be signed out in <span class="font-semibold text-ink">{{ countdownLabel }}</span> due to inactivity.
        Any unsaved changes on this page will be lost if you’re signed out.
      </p>

      <div class="mt-6 flex items-center justify-end gap-3">
        <button type="button" class="btn-outline" @click="logOutNow">Log out now</button>
        <button
          type="button"
          class="rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-coral/90"
          @click="continueSession"
        >
          Continue session
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

// Shared with plugins/idle-logout.client.js, whose 5s poll is the source of
// truth for { show, expiresAt } (and the only thing that decides real
// expiry — this component never does). "Continue session" hides the modal
// optimistically for a snappy response, after writing a fresh last-active
// timestamp — the next poll always agrees. "Log out now" leaves the modal
// as-is; the resulting redirect unmounts it.
const warning = useState('adminIdleWarning', () => ({ show: false, expiresAt: 0 }))
const { $adminIdleGuard } = useNuxtApp()

const nowTick = ref(Date.now())
let tickTimer = null
watch(
  () => warning.value.show,
  (show) => {
    if (show && !tickTimer) {
      tickTimer = window.setInterval(() => { nowTick.value = Date.now() }, 1000)
    } else if (!show && tickTimer) {
      window.clearInterval(tickTimer)
      tickTimer = null
    }
  },
  { immediate: true }
)
onBeforeUnmount(() => { if (tickTimer) window.clearInterval(tickTimer) })

const countdownLabel = computed(() => {
  const remainingSec = Math.max(0, Math.ceil((warning.value.expiresAt - nowTick.value) / 1000))
  const m = Math.floor(remainingSec / 60)
  const s = remainingSec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
})

function continueSession() {
  $adminIdleGuard?.recordActivity()
  warning.value = { show: false, expiresAt: 0 }
}
function logOutNow() {
  $adminIdleGuard?.signOutIdle()
}
</script>
