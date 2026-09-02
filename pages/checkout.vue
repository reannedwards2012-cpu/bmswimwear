<template>
  <div class="section container-bm">
    <p class="eyebrow">Your order</p>
    <h1 class="mt-2 font-display text-3xl font-semibold text-ink md:text-4xl">Checkout</h1>

    <ClientOnly>
      <!-- empty cart -->
      <div v-if="!items.length" class="mt-10 rounded-4xl bg-shell/60 p-10 text-center">
        <p class="text-ink/70">Your cart is empty.</p>
        <NuxtLink to="/shop" class="btn-primary mt-6">Back to shop</NuxtLink>
      </div>

      <!-- checkout -->
      <form
        v-else
        class="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-14"
        novalidate
        @submit.prevent="onSubmit"
      >
        <!-- left: customer + delivery -->
        <div class="space-y-10">
          <!-- customer -->
          <section>
            <h2 class="font-display text-lg font-semibold text-ink">Customer information</h2>
            <div class="mt-4 space-y-4">
              <div class="grid gap-4 sm:grid-cols-2">
                <CheckoutField label="First name" v-bind="bind(customer, 'firstName')" required autocomplete="given-name" />
                <CheckoutField label="Last name" v-bind="bind(customer, 'lastName')" required autocomplete="family-name" />
              </div>
              <CheckoutField label="Email address" type="email" v-bind="bind(customer, 'email')" required autocomplete="email" />
              <CheckoutField label="Phone number" type="tel" v-bind="bind(customer, 'phone')" required autocomplete="tel" />
            </div>
          </section>

          <!-- delivery method -->
          <section>
            <h2 class="font-display text-lg font-semibold text-ink">Delivery method</h2>
            <div class="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Delivery method">
              <label
                v-for="m in DELIVERY_METHODS"
                :key="m.value"
                class="flex cursor-pointer flex-col rounded-2xl border p-4 transition-colors"
                :class="
                  deliveryMethod === m.value
                    ? 'border-ink bg-cream shadow-card'
                    : 'border-ink/15 hover:border-ink/40'
                "
              >
                <span class="flex items-center gap-2">
                  <input
                    type="radio"
                    name="deliveryMethod"
                    class="accent-coral"
                    :value="m.value"
                    :checked="deliveryMethod === m.value"
                    @change="pickDelivery(m.value)"
                  >
                  <span class="text-sm font-semibold text-ink">{{ m.label }}</span>
                </span>
                <span class="mt-1 pl-6 text-xs text-ink/55">{{ m.hint }}</span>
              </label>
            </div>
            <p v-if="errors.deliveryMethod" class="mt-2 text-xs text-coral">{{ errors.deliveryMethod }}</p>
          </section>

          <!-- delivery address (shipping only) -->
          <section v-if="needsAddress">
            <h2 class="font-display text-lg font-semibold text-ink">Delivery address</h2>
            <div class="mt-4 space-y-4">
              <label class="block">
                <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Country</span>
                <select
                  :value="shippingAddress.country"
                  required
                  autocomplete="country-name"
                  :aria-invalid="errors.country ? 'true' : undefined"
                  class="mt-1.5 w-full rounded-2xl border bg-sand/60 px-4 py-2.5 text-sm text-ink focus:outline-none"
                  :class="errors.country ? 'border-coral' : 'border-ink/15 focus:border-coral'"
                  @change="pickCountry($event.target.value)"
                >
                  <option value="" disabled>Select a country</option>
                  <option v-for="c in COUNTRIES" :key="c" :value="c">{{ c }}</option>
                </select>
                <p v-if="errors.country" class="mt-1 text-xs text-coral">{{ errors.country }}</p>
              </label>

              <CheckoutField label="Address line 1" v-bind="bind(shippingAddress, 'address1')" required autocomplete="address-line1" />
              <CheckoutField label="Address line 2" v-bind="bind(shippingAddress, 'address2')" optional autocomplete="address-line2" />

              <div class="grid gap-4 sm:grid-cols-2">
                <CheckoutField label="City / Town" v-bind="bind(shippingAddress, 'city')" required autocomplete="address-level2" />
                <CheckoutField label="State / Parish / Province" v-bind="bind(shippingAddress, 'region')" optional autocomplete="address-level1" />
              </div>
              <CheckoutField label="Postal / ZIP code" v-bind="bind(shippingAddress, 'postalCode')" optional autocomplete="postal-code" />
            </div>
          </section>

          <!-- order notes -->
          <section>
            <h2 class="font-display text-lg font-semibold text-ink">Order notes</h2>
            <div class="mt-4">
              <CheckoutField
                v-model="notes"
                label="Anything we should know about your order?"
                type="textarea"
                optional
              />
              <p class="mt-1.5 text-xs text-ink/45">
                Size, colour and coverage come from your cart selections — no need to repeat them here.
              </p>
            </div>
          </section>
        </div>

        <!-- right: summary + CTA -->
        <aside class="space-y-4 lg:sticky lg:top-28 lg:h-fit">
          <div class="rounded-4xl bg-shell/60 p-6">
            <div class="flex items-center justify-between">
              <h2 class="font-display text-lg font-semibold text-ink">Order summary</h2>
              <NuxtLink to="/cart" class="text-xs font-semibold uppercase tracking-widest2 text-ink/45 hover:text-ink">
                Edit cart
              </NuxtLink>
            </div>

            <ul class="mt-4 divide-y divide-ink/10 border-t border-ink/10">
              <li v-for="item in items" :key="item.lineId" class="flex gap-3 py-4">
                <img :src="item.image" :alt="item.name" class="aspect-[3/4] w-14 shrink-0 rounded-xl object-cover" />
                <div class="flex min-w-0 flex-1 flex-col justify-center">
                  <div class="flex items-start justify-between gap-2">
                    <p class="text-sm font-medium text-ink">{{ item.name }}</p>
                    <span class="shrink-0 text-sm font-semibold text-ink">{{ money(item.priceUsd * item.quantity) }}</span>
                  </div>
                  <p v-if="optionSummary(item)" class="mt-0.5 text-xs text-ink/55">{{ optionSummary(item) }}</p>
                  <p class="mt-0.5 text-xs text-ink/55">Qty {{ item.quantity }}</p>
                </div>
              </li>
            </ul>

            <div class="mt-4 flex items-center justify-between border-t border-ink/10 pt-4 text-sm">
              <span class="text-ink/60">Subtotal</span>
              <span class="font-semibold text-ink">USD {{ money(subtotalUsd) }}</span>
            </div>

            <p class="mt-4 rounded-2xl bg-cream/70 px-4 py-3 text-xs leading-relaxed text-ink/60">
              <span class="font-semibold text-ink/75">Made to order · {{ turnaround }}</span><br >
              Production time only — delivery time is additional.
            </p>
          </div>

          <button
            type="submit"
            class="btn-primary w-full shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="submitting || orderCreated"
          >
            {{ submitLabel }}
          </button>

          <p v-if="formError" class="text-center text-xs text-coral">{{ formError }}</p>
          <p v-else-if="devOrder && isDev" class="text-center text-xs text-ink/45">
            Order {{ devOrder.displayOrderNumber }} created — pending payment (dev only).
          </p>
        </aside>
      </form>

      <template #fallback>
        <div class="mt-10 h-64 rounded-4xl bg-shell/40" />
      </template>
    </ClientOnly>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { MADE_TO_ORDER } from '~/data/products.js'
import { formatUsd } from '~/utils/money'
import { COUNTRIES } from '~/utils/countries'
import { DELIVERY_METHODS, useCheckout } from '~/composables/useCheckout'

useHead({ title: 'Checkout — Bahama Mama Swimwear' })

const { items, subtotalUsd } = useCart()
const {
  customer,
  deliveryMethod,
  shippingAddress,
  notes,
  errors,
  needsAddress,
  clearError,
  validate,
  buildPayload
} = useCheckout()

const turnaround = MADE_TO_ORDER.turnaround
const money = formatUsd
const isDev = import.meta.dev

const submitting = ref(false)
const orderCreated = ref(false)
const formError = ref('')
const devOrder = ref(null)

const submitLabel = computed(() => {
  if (orderCreated.value) return 'Order placed'
  if (submitting.value) return 'Placing your order…'
  return 'Continue to payment'
})

const optionSummary = (item) => [item.size, item.colourName, item.coverage].filter(Boolean).join(' · ')

// Bind a reactive object's field to a CheckoutField, clearing its error on edit.
const bind = (obj, key) => ({
  modelValue: obj[key],
  'onUpdate:modelValue': (v) => {
    obj[key] = v
    clearError(key)
  },
  error: errors[key] || ''
})

function pickDelivery(value) {
  deliveryMethod.value = value
  clearError('deliveryMethod')
}

function pickCountry(value) {
  shippingAddress.country = value
  clearError('country')
}

async function onSubmit() {
  // Guard both the in-flight window and — for this pre-Go2Pay phase — a
  // second submission after an order was already created for this page state.
  if (submitting.value || orderCreated.value) return

  formError.value = ''

  if (!validate()) {
    formError.value = 'Please complete the highlighted fields.'
    return
  }

  submitting.value = true
  try {
    const res = await $fetch('/api/checkout', {
      method: 'POST',
      body: buildPayload()
    })
    devOrder.value = res
    orderCreated.value = true
    // Cart is intentionally NOT cleared in this pre-Go2Pay phase.
  } catch (err) {
    formError.value =
      err?.data?.error || 'Something went wrong placing your order. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>
