<template>
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center sm:p-6"
    @click.self="$emit('cancel')"
  >
    <div class="max-h-[92vh] w-full overflow-y-auto rounded-t-4xl bg-cream p-6 shadow-card sm:max-w-lg sm:rounded-4xl sm:p-8">
      <div class="flex items-center justify-between">
        <h2 class="font-display text-lg font-semibold text-ink">{{ isEdit ? 'Edit Stockist' : 'Add Stockist' }}</h2>
        <button type="button" class="text-ink/40 transition-colors hover:text-ink" aria-label="Close" @click="$emit('cancel')">✕</button>
      </div>

      <form class="mt-6 space-y-5" novalidate @submit.prevent="onSubmit">
        <label class="block">
          <span class="lbl">Name</span>
          <input v-model.trim="form.name" type="text" placeholder="The Closet" class="inp" />
        </label>

        <label class="block">
          <span class="lbl">Location</span>
          <input v-model.trim="form.location" type="text" placeholder="Grand Anse, Grenada" class="inp" />
        </label>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="lbl">Contact name</span>
            <input v-model.trim="form.contactName" type="text" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Phone</span>
            <input v-model.trim="form.phone" type="text" class="inp" />
          </label>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="lbl">Email</span>
            <input v-model.trim="form.email" type="email" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Default commission %</span>
            <input v-model="form.defaultCommission" type="number" min="0" max="100" step="0.1" placeholder="15" class="inp" />
          </label>
        </div>

        <label class="block">
          <span class="lbl">Notes</span>
          <textarea v-model.trim="form.notes" rows="3" class="inp" />
        </label>

        <label v-if="isEdit" class="flex items-center gap-2 text-sm text-ink/70">
          <input v-model="form.isActive" type="checkbox" class="h-4 w-4 accent-coral" />
          Active
        </label>

        <p v-if="formError" class="text-sm text-coral">{{ formError }}</p>
        <ul v-if="formIssues.length" class="list-disc space-y-1 pl-5 text-xs text-coral">
          <li v-for="(msg, i) in formIssues" :key="i">{{ msg }}</li>
        </ul>

        <div class="flex items-center justify-end gap-3 border-t border-ink/10 pt-5">
          <button type="button" class="btn-outline" @click="$emit('cancel')">Cancel</button>
          <button type="submit" class="btn-primary disabled:cursor-not-allowed disabled:opacity-60" :disabled="saving">
            {{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add stockist' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'

const props = defineProps({
  stockist: { type: Object, default: null } // null = creating
})
const emit = defineEmits(['saved', 'cancel'])

const isEdit = computed(() => !!props.stockist)

const { getAccessToken } = useAuth()
async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const bpsToInput = (bps) => (typeof bps === 'number' ? (bps / 100).toString() : '')

function blankForm() {
  return { name: '', location: '', contactName: '', phone: '', email: '', defaultCommission: '', notes: '', isActive: true }
}
function fromStockist(s) {
  return {
    name: s.name ?? '',
    location: s.location ?? '',
    contactName: s.contactName ?? '',
    phone: s.phone ?? '',
    email: s.email ?? '',
    defaultCommission: bpsToInput(s.defaultCommissionBps),
    notes: s.notes ?? '',
    isActive: s.isActive ?? true
  }
}

const form = reactive(props.stockist ? fromStockist(props.stockist) : blankForm())

function percentToBps(v) {
  if (v === '' || v === null || v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}

const saving = ref(false)
const formError = ref('')
const formIssues = ref([])

async function onSubmit() {
  saving.value = true
  formError.value = ''
  formIssues.value = []

  const payload = {
    name: form.name,
    location: form.location || null,
    contactName: form.contactName || null,
    phone: form.phone || null,
    email: form.email || null,
    defaultCommissionBps: percentToBps(form.defaultCommission),
    notes: form.notes || null,
    ...(isEdit.value ? { isActive: form.isActive } : {})
  }

  try {
    const res = isEdit.value
      ? await authedFetch(`/api/admin/stockists/${props.stockist.id}`, { method: 'PATCH', body: payload })
      : await authedFetch('/api/admin/stockists', { method: 'POST', body: payload })
    emit('saved', res.stockist)
  } catch (err) {
    formError.value = err?.data?.error || 'Something went wrong saving this stockist.'
    formIssues.value = err?.data?.issues || []
  } finally {
    saving.value = false
  }
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
