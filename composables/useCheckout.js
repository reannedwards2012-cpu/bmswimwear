/**
 * Checkout form state, validation and payload shaping.
 *
 * Instantiated once by pages/checkout.vue — this creates its own reactive
 * state on each call (it is NOT a shared singleton like useCart). Keeping the
 * form shape + rules here means the page template only wires fields, and a
 * future server checkout action receives a ready-made payload from
 * `buildPayload()` with no page changes.
 */
import { computed, reactive, ref } from 'vue'

export const DELIVERY_METHODS = [
  { value: 'pickup', label: 'Pickup', hint: 'Pickup details will be provided with your order.' },
  { value: 'shipping', label: 'Delivery / Shipping', hint: 'We’ll ship to your address.' }
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CHECKOUT_STORE_KEY = 'bm-checkout'

// Fingerprint of the current cart — the checkout id is regenerated whenever the
// cart's lines or quantities change, so a stale attempt can't be reused.
function cartFingerprint(items) {
  return items
    .map((i) => `${i.lineId}:${i.quantity}`)
    .sort()
    .join('|')
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

  /**
   * Stable id for this checkout attempt, persisted per-tab in sessionStorage
   * and tied to the current cart contents. Lets a return from a failed or
   * cancelled payment resume the SAME pending order (server-side idempotency)
   * instead of creating a duplicate.
   */
  function checkoutId() {
    const fp = cartFingerprint(items.value)
    const stored = readStore()
    if (stored?.id && stored.fp === fp) return stored.id

    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}` // dev-only fallback
    try {
      sessionStorage?.setItem(CHECKOUT_STORE_KEY, JSON.stringify({ id, fp }))
    } catch {
      /* storage unavailable — id still valid for this request */
    }
    return id
  }

  /** The stored id without the cart-fingerprint check (for the return page). */
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

  const customer = reactive({ firstName: '', lastName: '', email: '', phone: '' })
  const deliveryMethod = ref('') // '' | 'pickup' | 'shipping'
  const shippingAddress = reactive({
    country: '',
    address1: '',
    address2: '',
    city: '',
    region: '',
    postalCode: ''
  })
  const notes = ref('')

  // Flat map of field key -> message. Only populated on a submit attempt.
  const errors = reactive({})

  const needsAddress = computed(() => deliveryMethod.value === 'shipping')

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

    if (!deliveryMethod.value) errors.deliveryMethod = 'Choose a delivery method.'

    if (needsAddress.value) {
      if (!shippingAddress.country) errors.country = 'Select a country.'
      if (!shippingAddress.address1.trim()) errors.address1 = 'Enter your address.'
      if (!shippingAddress.city.trim()) errors.city = 'Enter your city or town.'
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
      deliveryMethod: deliveryMethod.value,
      shippingAddress: needsAddress.value
        ? {
            country: shippingAddress.country,
            address1: shippingAddress.address1.trim(),
            address2: shippingAddress.address2.trim(),
            city: shippingAddress.city.trim(),
            region: shippingAddress.region.trim(),
            postalCode: shippingAddress.postalCode.trim()
          }
        : null,
      notes: notes.value.trim(),
      items: items.value.map((i) => ({ ...i })),
      subtotalUsd: subtotalUsd.value
    }
  }

  return {
    customer,
    deliveryMethod,
    shippingAddress,
    notes,
    errors,
    needsAddress,
    clearError,
    validate,
    buildPayload,
    readCheckoutId,
    clearCheckoutId
  }
}
