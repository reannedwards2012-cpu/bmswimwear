<template>
  <div class="mx-auto max-w-md">
    <FancyHeading :eyebrow="eyebrow" :title="heading" center size="sm" as="h1" />

    <div class="mt-7 rounded-4xl bg-cream p-7 shadow-card md:p-9">
      <!-- After sign-up with email confirmation required -->
      <div v-if="confirmSent" class="space-y-4 text-sm leading-relaxed text-ink/70">
        <p>
          We’ve sent a confirmation link to
          <span class="font-medium text-ink">{{ form.email }}</span>. Open it to activate your
          account, then come back and sign in.
        </p>
        <p class="text-ink/45">You’re not signed in yet — the link finishes the setup.</p>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
          <button
            type="button"
            class="btn-outline"
            :disabled="resend.state === 'sending'"
            @click="onResend"
          >
            {{ resendLabel }}
          </button>
          <NuxtLink :to="withRedirect('/login')" class="text-sm text-coral link-underline">
            Go to sign in
          </NuxtLink>
        </div>
        <p v-if="resend.state === 'sent'" class="text-xs text-ink/45">Sent — check your inbox.</p>
        <p v-if="resend.state === 'error'" class="text-xs text-coral">{{ resend.error }}</p>
      </div>

      <!-- Sign in / Sign up form -->
      <form v-else class="space-y-4" novalidate @submit.prevent="onSubmit">
        <label class="block">
          <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Email</span>
          <input
            v-model="form.email"
            type="email"
            autocomplete="email"
            required
            :class="inputClass(fieldError.email)"
            @input="delete fieldError.email"
          >
          <p v-if="fieldError.email" class="mt-1 text-xs text-coral">{{ fieldError.email }}</p>
        </label>

        <label class="block">
          <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Password</span>
          <input
            v-model="form.password"
            type="password"
            :autocomplete="isSignup ? 'new-password' : 'current-password'"
            required
            :class="inputClass(fieldError.password)"
            @input="delete fieldError.password"
          >
          <p v-if="fieldError.password" class="mt-1 text-xs text-coral">{{ fieldError.password }}</p>
          <p v-else-if="isSignup" class="mt-1 text-xs text-ink/40">{{ PASSWORD_HINT }}</p>
        </label>

        <label v-if="isSignup" class="block">
          <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Confirm password</span>
          <input
            v-model="form.confirm"
            type="password"
            autocomplete="new-password"
            required
            :class="inputClass(fieldError.confirm)"
            @input="delete fieldError.confirm"
          >
          <p v-if="fieldError.confirm" class="mt-1 text-xs text-coral">{{ fieldError.confirm }}</p>
        </label>

        <div v-if="!isSignup" class="text-right">
          <NuxtLink to="/forgot-password" class="text-xs text-coral link-underline">Forgot password?</NuxtLink>
        </div>

        <button type="submit" class="btn-primary w-full shadow-soft" :disabled="loading">
          {{ loading ? 'One moment…' : isSignup ? 'Create account' : 'Sign in' }}
        </button>

        <p v-if="formError" class="text-sm text-coral">{{ formError }}</p>

        <div v-if="needsConfirm" class="rounded-2xl bg-shell/60 p-4 text-sm leading-relaxed text-ink/70">
          <p>Your email isn’t confirmed yet — check your inbox for the link we sent when you signed up.</p>
          <button
            type="button"
            class="btn-outline mt-3"
            :disabled="resend.state === 'sending'"
            @click="onResend"
          >
            {{ resendLabel }}
          </button>
          <p v-if="resend.state === 'sent'" class="mt-2 text-xs text-ink/45">Sent — check your inbox.</p>
          <p v-if="resend.state === 'error'" class="mt-2 text-xs text-coral">{{ resend.error }}</p>
        </div>
      </form>

      <p v-if="!confirmSent" class="mt-5 text-center text-sm text-ink/60">
        <template v-if="isSignup">
          Already have an account?
          <NuxtLink :to="withRedirect('/login')" class="text-coral link-underline">Sign in</NuxtLink>
        </template>
        <template v-else>
          New here?
          <NuxtLink :to="withRedirect('/register')" class="text-coral link-underline">Create an account</NuxtLink>
        </template>
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { PASSWORD_HINT, friendlyAuthError } from '~/utils/authErrors'

const props = defineProps({
  mode: { type: String, default: 'signin' } // 'signin' | 'signup'
})
const emit = defineEmits(['authenticated'])

const { signIn, signUp, resendConfirmation } = useAuth()
const route = useRoute()

const isSignup = computed(() => props.mode === 'signup')

const form = reactive({ email: '', password: '', confirm: '' })
const fieldError = reactive({})
const formError = ref('')
const loading = ref(false)
const confirmSent = ref(false)
const needsConfirm = ref(false)
const resend = reactive({ state: '', error: '' })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const heading = computed(() =>
  confirmSent.value
    ? 'Check your *inbox*'
    : isSignup.value
      ? 'Create your *account*'
      : 'Welcome *back*'
)
const eyebrow = computed(() => (confirmSent.value ? 'Almost there' : 'Account'))

const redirectPath = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : ''
})
const withRedirect = (path) =>
  redirectPath.value ? `${path}?redirect=${encodeURIComponent(redirectPath.value)}` : path

const inputClass = (err) => [
  'mt-1.5 w-full rounded-2xl border bg-sand/60 px-4 py-2.5 text-sm text-ink focus:outline-none',
  err ? 'border-coral' : 'border-ink/15 focus:border-coral'
]

const resendLabel = computed(
  () => ({ sending: 'Sending…', sent: 'Resend again' })[resend.state] || 'Resend confirmation email'
)

function validate() {
  for (const k of Object.keys(fieldError)) delete fieldError[k]
  if (!EMAIL_RE.test(form.email.trim())) fieldError.email = 'Enter a valid email address.'
  if (!form.password) fieldError.password = 'Enter your password.'
  else if (isSignup.value && form.password.length < 8) fieldError.password = 'Use at least 8 characters.'
  if (isSignup.value && form.confirm !== form.password) fieldError.confirm = 'Those passwords don’t match.'
  return Object.keys(fieldError).length === 0
}

async function onSubmit() {
  formError.value = ''
  needsConfirm.value = false
  if (!validate()) return

  loading.value = true
  try {
    if (isSignup.value) {
      const { error, needsConfirmation, alreadyRegistered } = await signUp(form.email, form.password)
      if (error) {
        formError.value = friendlyAuthError(error)
        return
      }
      if (alreadyRegistered) {
        formError.value = 'That email already has an account — try signing in or resetting your password.'
        return
      }
      if (needsConfirmation) {
        confirmSent.value = true
        return
      }
      emit('authenticated') // email confirmation disabled -> a real session exists
    } else {
      const { error } = await signIn(form.email, form.password)
      if (error) {
        if (/email not confirmed/i.test(error)) {
          needsConfirm.value = true
          return
        }
        formError.value = friendlyAuthError(error)
        return
      }
      emit('authenticated')
    }
  } finally {
    loading.value = false
  }
}

async function onResend() {
  resend.state = 'sending'
  resend.error = ''
  const { error } = await resendConfirmation(form.email)
  if (error) {
    resend.state = 'error'
    resend.error = friendlyAuthError(error)
  } else {
    resend.state = 'sent'
  }
}
</script>
