import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Cloudflare Turnstile widget lifecycle — shared by every checkout/booking
 * form that needs it (pages/checkout/index.vue,
 * components/bikini-mix/customer/StepReview.vue). Mirrors the inline
 * implementation originally built for pages/contact.vue exactly (same
 * script-loading guard, same 'flexible' size, same reset-on-failure
 * contract), extracted here so new forms don't re-implement it.
 *
 * No widget is rendered at all when no site key is configured (local/dev) —
 * matches the server-side fail-open behaviour for that same case in
 * server/utils/turnstile.js.
 */
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
const SCRIPT_ID = 'cf-turnstile-script'

function loadTurnstileScript() {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve()
      return
    }
    const existing = document.getElementById(SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('turnstile script failed to load')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error('turnstile script failed to load')), { once: true })
    document.head.appendChild(script)
  })
}

export function useTurnstile() {
  const siteKey = useRuntimeConfig().public.turnstileSiteKey
  const containerEl = ref(null)
  const token = ref('')
  let widgetId = null

  function render() {
    if (!containerEl.value || !window.turnstile) return
    widgetId = window.turnstile.render(containerEl.value, {
      sitekey: siteKey,
      size: 'flexible',
      callback: (t) => {
        token.value = t
      },
      'expired-callback': () => {
        token.value = ''
      },
      'error-callback': () => {
        token.value = ''
      }
    })
  }

  /** Call after a failed/retried submission — a used/expired token can't be reused. */
  function reset() {
    token.value = ''
    if (window.turnstile && widgetId != null) {
      window.turnstile.reset(widgetId)
    }
  }

  onMounted(async () => {
    if (!siteKey || !import.meta.client) return
    try {
      await loadTurnstileScript()
      render()
    } catch (err) {
      console.error('[turnstile] failed to load:', err?.message)
    }
  })

  onBeforeUnmount(() => {
    if (window.turnstile && widgetId != null) {
      window.turnstile.remove(widgetId)
    }
  })

  return { siteKey, containerEl, token, reset }
}
