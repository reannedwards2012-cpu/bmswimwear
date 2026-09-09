/**
 * Checkout form state, validation and payload shaping.
 *
 * Instantiated once by pages/checkout/index.vue — this creates its own reactive
 * state on each call (it is NOT a shared singleton like useCart).
 *
 * Delivery is NOT a customer choice anymore: the method + charge are derived
 * server-side from the destination (server/utils/shipping.js).
 *   Grenada  → Local Delivery, Saint George parish only, no charge
 *   elsewhere→ International Shipping, priced from zone + weight
 * Every website order now carries a delivery address; the page shows a live
 * Subtotal / Shipping / Total from GET-free POST /api/checkout/quote, and the
 * authoritative checkout endpoint recomputes everything regardless.
 */
import { computed, reactive, ref } from 'vue'
import { GRENADA } from '~/utils/countries'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CHECKOUT_STORE_KEY = 'bm-checkout'

/**
 * Fingerprint of everything that can change the authoritative payable amount —
 * cart lines/quantities AND the destination (country + parish/region). The
 * checkout id is regenerated whenever this changes, so a Go2Pay Payment Request
 * minted for one total can never be reused to charge a different total.
 */
function checkoutFingerprint(items, country, region) {
  const lines = items
    .map((i) => `${i.lineId}:${i.quantity}`)
    .sort()
    .join('|')
  const dest = `${(country || '').trim()}::${(region || '').trim().toLowerCase()}`
  return `${lines}##${dest}`
}

function readStore() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    return JSON.parse(sessionStorage.getItem(CHECKOUT_STORE_KEY) || 'null')
  } catch {
    return null
  }
}

export function useCheckout() {
  const { items, subtotalUsd } = useCart()

  const customer = reactive({ firstName: '', lastName: '', email: '', phone: '' })
  const shippingAddress = reactive({
    country: '',
    address1: '',
    address2: '',
    city: '',
    region: '',
    postalCode: ''
  })
  const notes = ref('')
  // Explicit marketing consent — MUST default unchecked.
  const marketingOptIn = ref(false)

  // Flat map of field key -> message. Only populated on a submit attempt.
  const errors = reactive({})

  const isGrenada = computed(() => shippingAddress.country === GRENADA)
  const deliveryLabel = computed(() => {
    if (!shippingAddress.country) return ''
    return isGrenada.value ? 'Local Delivery' : 'International Shipping'
  })

  /**
   * Stable id for this checkout attempt, persisted per-tab in sessionStorage
   * and tied to the current cart contents + destination.
   */
  function checkoutId() {
    const fp = checkoutFingerprint(items.value, shippingAddress.country, shippingAddress.region)
    const stored = readStore()
    if (stored?.id && stored.fp === fp) return stored.id

    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    try {
      sessionStorage?.setItem(CHECKOUT_STORE_KEY, JSON.stringify({ id, fp }))
    } catch {
      /* storage unavailable — id still valid for this request */
    }
    return id
  }

  /** The stored id without the fingerprint check (for the return page). */
  function readCheckoutId() {
    return readStore()?.id || null
  }

  function clearCheckoutId() {
    try {
      sessionStorage?.removeItem(CHECKOUT_STORE_KEY)
    } catch {
      /* ignore */
    }
  }

  function clearError(key) {
    delete errors[key]
  }

  function validate() {
    for (const k of Object.keys(errors)) delete errors[k]

    if (!customer.firstName.trim()) errors.firstName = 'Enter your first name.'
    if (!customer.lastName.trim()) errors.lastName = 'Enter your last name.'
    if (!customer.email.trim()) errors.email = 'Enter your email address.'
    else if (!EMAIL_RE.test(customer.email.trim())) errors.email = 'Enter a valid email address.'

    const digits = customer.phone.replace(/\D/g, '')
    if (!customer.phone.trim()) errors.phone = 'Enter your phone number.'
    else if (digits.length < 7) errors.phone = 'Enter a valid phone number.'

    if (!shippingAddress.country) errors.country = 'Select a country.'
    if (!shippingAddress.address1.trim()) errors.address1 = 'Enter your address.'
    if (!shippingAddress.city.trim()) errors.city = 'Enter your city or town.'

    if (isGrenada.value) {
      if (!shippingAddress.region) errors.region = 'Select your parish.'
      else if (shippingAddress.region !== 'Saint George') {
        errors.region = 'Local delivery is currently available within St. George only.'
      }
    }

    return Object.keys(errors).length === 0
  }

  /** The complete order payload sent to POST /api/checkout. */
  function buildPayload() {
    return {
      checkoutId: checkoutId(),
      customer: {
        firstName: customer.firstName.trim(),
        lastName: customer.lastName.trim(),
        email: customer.email.trim(),
        phone: customer.phone.trim()
      },
      shippingAddress: {
        country: shippingAddress.country,
        address1: shippingAddress.address1.trim(),
        address2: shippingAddress.address2.trim(),
        city: shippingAddress.city.trim(),
        region: shippingAddress.region.trim(),
        postalCode: shippingAddress.postalCode.trim()
      },
      notes: notes.value.trim(),
      items: items.value.map((i) => ({ ...i })),
      marketingOptIn: marketingOptIn.value === true
    }
  }

  return {
    customer,
    shippingAddress,
    notes,
    marketingOptIn,
    errors,
    isGrenada,
    deliveryLabel,
    clearError,
    validate,
    buildPayload,
    readCheckoutId,
    clearCheckoutId
  }
}
