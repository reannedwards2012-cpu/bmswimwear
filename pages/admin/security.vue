<template>
  <div>
    <FancyHeading eyebrow="Admin" title="*Security*" size="sm" as="h1" />

    <section class="mt-8 max-w-lg rounded-4xl bg-cream p-6 shadow-card md:p-7">
      <h2 class="font-display text-lg font-semibold text-ink">Two-factor authentication</h2>
      <p class="mt-1 text-sm text-ink/60">
        Required for every admin account — an authenticator app code is needed in addition to your password.
      </p>

      <p v-if="loading" class="mt-5 text-sm text-ink/50">Loading…</p>

      <!-- already enrolled -->
      <div v-else-if="verifiedFactor && !enrolling" class="mt-5">
        <div class="flex items-center gap-2 rounded-2xl bg-shell/60 px-4 py-3 text-sm text-ink/70">
          <span class="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
          Two-factor authentication is enabled.
        </div>
        <p class="mt-2 text-xs text-ink/45">Added {{ formatDate(verifiedFactor.created_at) }}</p>

        <button type="button" class="btn-outline mt-5" @click="confirmRemove = true">
          Remove and set up again
        </button>

        <div v-if="confirmRemove" class="mt-4 rounded-2xl bg-sand/60 p-4 text-sm text-ink/70">
          <p>
            This immediately removes your current authenticator. You’ll need to set up a new one
            before you can access the rest of the admin dashboard again.
          </p>
          <div class="mt-3 flex items-center gap-3">
            <button type="button" class="btn-outline px-4 py-1.5 text-xs" :disabled="removing" @click="confirmRemove = false">
              Cancel
            </button>
            <button
              type="button"
              class="rounded-full bg-coral px-5 py-2.5 text-xs font-semibold text-cream transition-colors hover:bg-coral/90 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="removing"
              @click="onRemove"
            >
              {{ removing ? 'Removing…' : 'Remove it' }}
            </button>
          </div>
          <p v-if="removeError" class="mt-2 text-xs text-coral">{{ removeError }}</p>
        </div>
      </div>

      <!-- not enrolled yet, haven't started -->
      <div v-else-if="!enrolling" class="mt-5">
        <p class="text-sm text-ink/70">
          Set this up using an authenticator app such as
          <span class="font-medium text-ink">Google Authenticator</span> or
          <span class="font-medium text-ink">Microsoft Authenticator</span>.
        </p>
        <button type="button" class="btn-primary mt-4" :disabled="startingEnroll" @click="onBeginEnroll">
          {{ startingEnroll ? 'Starting…' : 'Begin setup' }}
        </button>
        <p v-if="enrollError" class="mt-3 text-sm text-coral">{{ enrollError }}</p>
      </div>

      <!-- enrolling: show QR + secret + code entry -->
      <div v-else class="mt-5 space-y-4">
        <ol class="list-decimal space-y-1 pl-5 text-sm text-ink/70">
          <li>Open your authenticator app.</li>
          <li>Scan the QR code below, or enter the setup key manually.</li>
          <li>Enter the 6-digit code it shows you.</li>
        </ol>

        <div class="flex items-center justify-center rounded-2xl bg-sand/60 p-5">
          <img v-if="qrCode" :src="qrCode" alt="Scan this QR code with your authenticator app" class="h-40 w-40" />
        </div>

        <div>
          <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Can’t scan it?</p>
          <p class="mt-1 break-all rounded-2xl bg-sand/60 px-4 py-2.5 font-mono text-xs text-ink">{{ secret }}</p>
          <p class="mt-1 text-xs text-ink/40">Enter this setup key manually in your authenticator app instead.</p>
        </div>

        <form novalidate @submit.prevent="onVerify">
          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">6-digit code</span>
            <input
              v-model="code"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              placeholder="123456"
              class="mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-center text-lg tracking-[0.3em] text-ink focus:border-coral focus:outline-none"
              :class="{ 'border-coral': verifyError }"
              @input="verifyError = ''"
            >
          </label>
          <p v-if="verifyError" class="mt-2 text-xs text-coral">{{ verifyError }}</p>

          <div class="mt-4 flex items-center gap-3">
            <button type="button" class="btn-outline px-4 py-1.5 text-xs" :disabled="verifying" @click="onCancelEnroll">
              Cancel
            </button>
            <button type="submit" class="btn-primary disabled:cursor-not-allowed disabled:opacity-60" :disabled="verifying || code.length !== 6">
              {{ verifying ? 'Verifying…' : 'Verify and enable' }}
            </button>
          </div>
        </form>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { friendlyAuthError } from '~/utils/authErrors'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Security — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const { listTotpFactors, enrollTotp, verifyTotp, unenrollTotp } = useAuth()

const loading = ref(true)
const verifiedFactor = ref(null)

async function loadFactors() {
  loading.value = true
  const { factors } = await listTotpFactors()
  verifiedFactor.value = factors.find((f) => f.status === 'verified') ?? null
  loading.value = false
}
onMounted(loadFactors)

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

// ── enrollment ──
const enrolling = ref(false)
const startingEnroll = ref(false)
const enrollError = ref('')
const pendingFactorId = ref(null)
const qrCode = ref('')
const secret = ref('')
const code = ref('')
const verifying = ref(false)
const verifyError = ref('')

async function onBeginEnroll() {
  enrollError.value = ''
  startingEnroll.value = true
  try {
    const res = await enrollTotp('Authenticator app')
    if (res.error) {
      enrollError.value = friendlyAuthError(res.error)
      return
    }
    pendingFactorId.value = res.factorId
    qrCode.value = res.qrCode
    secret.value = res.secret
    code.value = ''
    enrolling.value = true
  } finally {
    startingEnroll.value = false
  }
}

async function onVerify() {
  verifyError.value = ''
  verifying.value = true
  try {
    const { error } = await verifyTotp(pendingFactorId.value, code.value.trim())
    if (error) {
      verifyError.value = friendlyAuthError(error)
      code.value = ''
      return
    }
    enrolling.value = false
    pendingFactorId.value = null
    await loadFactors()
  } finally {
    verifying.value = false
  }
}

async function onCancelEnroll() {
  // Best-effort cleanup of the abandoned, still-unverified factor — doesn't
  // need aal2 (that rule only applies to removing a VERIFIED factor), and
  // avoids leaving a stale pending factor that could block re-enrolling.
  if (pendingFactorId.value) {
    try {
      await unenrollTotp(pendingFactorId.value)
    } catch {
      /* best-effort — the admin can just try enrolling again either way */
    }
  }
  enrolling.value = false
  pendingFactorId.value = null
  code.value = ''
  verifyError.value = ''
}

// ── removal (re-enrolling on a new device) ──
const confirmRemove = ref(false)
const removing = ref(false)
const removeError = ref('')

async function onRemove() {
  if (!verifiedFactor.value) return
  removeError.value = ''
  removing.value = true
  try {
    const { error } = await unenrollTotp(verifiedFactor.value.id)
    if (error) {
      removeError.value = friendlyAuthError(error)
      return
    }
    confirmRemove.value = false
    await loadFactors()
  } finally {
    removing.value = false
  }
}
</script>
