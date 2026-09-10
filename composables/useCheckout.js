/**
 * Checkout form state, validation and payload shaping.
 *
 * Instantiated once by pages/checkout/index.vue — this creates its own reactive
 * state on each call (it is NOT a shared singleton like useCart).
 *
 * The customer picks a delivery METHOD (mutually exclusive):
 *   local_delivery        → St. George, Grenada only. One free-text
 *                           "delivery address / area" field, no charge.
 *   international_shipping → full international address; the charge is computed
 *                           server-side from destination zone + product weight.
 *
 * The browser sends the chosen method, but the authoritative checkout endpoint
 * recomputes the zone, weight, shipping and total regardless
 * (server/utils/checkoutOrder.js + shipping.js). The page also shows a live
 * Subtotal / Shipping / Total from the display-only POST /api/checkout/quote.
 */
import { computed, reactive, ref } from 'vue'

export const DELIVERY_METHODS = [
  {
    value: 'local_delivery',
    label: 'Local Delivery',
    hint: 'Available within St. George only.'
  },
  {
    value: 'international_shipping',
    label: 'International Shipping',
    hint: 'Calculated from your destination and order weight.'
  }
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CHECKOUT_STORE_KEY = 'bm-checkout'

/**
 * Fingerprint of everything that can change the authoritative payable amount —
 * cart lines/quantities, the chosen delivery method, AND (for international) the
 * destination. The checkout id regenerates when this changes, so a Go2Pay
 * Payment Request minted for one total can never be reused to charge another.
 */
function checkoutFingerprint(items, method, country, region) {
  const lines = items
    .map((i) => `${i.lineId}:${i.quantity}`)
    .sort()
    .join('|')
  const dest =
    method === 'local_delivery'
      ? 'local'
      : ['intl', (country || '').trim(), (region || '').trim().toLowerCase()].join('::')
  return `${lines}##${method || ''}##${dest}`
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
  // Bahama Mama is Grenada-based; the old checkout had no default, so Local
  // Delivery is the sensible default here.
  const deliveryMethod = ref('local_delivery')
  const shippingAddress = reactive({
    country: '',
    address1: '', // international: address line 1 · local: the delivery area
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

  const isLocal = computed(() => deliveryMethod.value === 'local_delivery')
  const deliveryLabel = computed(() => (isLocal.value ? 'Local Delivery' : 'International Shipping'))

  function checkoutId() {
    const fp = checkoutFingerprint(
      items.value,
      deliveryMethod.value,
      shippingAddress.country,
      shippingAddress.region
    )
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

    if (isLocal.value) {
      if (!shippingAddress.address1.trim()) errors.address1 = 'Enter your delivery address or area.'
    } else {
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
    deliveryMethod,
    shippingAddress,
    notes,
    marketingOptIn,
    errors,
    isLocal,
    deliveryLabel,
    clearError,
    validate,
    buildPayload,
    readCheckoutId,
    clearCheckoutId
  }
}
