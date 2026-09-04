<template>
  <div class="section container-bm">
    <div class="mx-auto max-w-2xl">
      <FancyHeading eyebrow="Account" title="My *orders*" center size="sm" as="h1" />

      <div class="mt-7">
        <p
          v-if="pending"
          class="rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card"
        >
          Loading your orders…
        </p>

        <div v-else-if="error" class="rounded-4xl bg-cream p-7 text-center shadow-card">
          <p class="text-sm text-coral">We couldn’t load your orders just now.</p>
          <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
        </div>

        <div v-else-if="!orders.length" class="rounded-4xl bg-cream p-8 text-center shadow-card">
          <p class="text-sm text-ink/70">No orders linked to your account yet.</p>
          <p class="mt-1 text-xs text-ink/40">Orders you place while signed in will show up here.</p>
          <NuxtLink to="/shop" class="btn-primary mt-6">Shop swimwear</NuxtLink>
        </div>

        <ul v-else class="space-y-5">
          <li
            v-for="o in orders"
            :key="o.orderNumber"
            class="rounded-4xl bg-cream p-6 shadow-card md:p-7"
          >
            <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p class="font-display text-lg font-semibold text-ink">{{ o.orderNumber }}</p>
              <span
                class="text-[0.7rem] font-semibold uppercase tracking-widest2"
                :class="o.status === 'paid' ? 'text-ink/50' : 'text-coral'"
              >
                {{ statusLabel(o.status) }}
              </span>
            </div>
            <p class="mt-0.5 text-xs text-ink/45">
              {{ formatDate(o.createdAt) }} · {{ o.deliveryMethod === 'shipping' ? 'Delivery' : 'Pickup' }}
            </p>

            <ul class="mt-4 divide-y divide-ink/10 border-t border-ink/10">
              <li v-for="(it, i) in o.items" :key="i" class="flex gap-3 py-3">
                <img
                  :src="it.image"
                  :alt="it.productName"
                  class="aspect-[3/4] w-14 shrink-0 rounded-xl object-cover"
                >
                <div class="flex min-w-0 flex-1 flex-col justify-center">
                  <p class="text-sm font-medium text-ink">{{ it.productName }}</p>
                  <p v-if="optionText(it)" class="mt-0.5 text-xs text-ink/55">{{ optionText(it) }}</p>
                  <div class="mt-1 flex items-center justify-between text-xs text-ink/55">
                    <span>Qty {{ it.quantity }}</span>
                    <span>{{ money(it.unitPriceUsdCents / 100) }} each</span>
                  </div>
                </div>
              </li>
            </ul>

            <div class="mt-3 flex items-center justify-between border-t border-ink/10 pt-3 text-sm">
              <span class="text-ink/60">Subtotal</span>
              <span class="font-semibold text-ink">USD {{ money(o.subtotalUsdCents / 100) }}</span>
            </div>
          </li>
        </ul>
      </div>

      <p class="mt-6 text-center text-sm">
        <NuxtLink to="/account" class="text-coral link-underline">Back to account</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatUsd } from '~/utils/money'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'My orders — Bahama Mama Swimwear' })

const { getAccessToken } = useAuth()
const money = formatUsd

const { data, pending, error, refresh } = useLazyAsyncData(
  'account-orders',
  async () => {
    const token = await getAccessToken()
    if (!token) {
      await navigateTo('/login?redirect=/account/orders')
      return { orders: [] }
    }
    try {
      return await $fetch('/api/account/orders', {
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch (err) {
      if (err?.statusCode === 401 || err?.response?.status === 401) {
        await navigateTo('/login?redirect=/account/orders')
        return { orders: [] }
      }
      throw err
    }
  },
  { server: false }
)

const orders = computed(() => data.value?.orders ?? [])

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return ''
  }
}

const optionText = (it) => [it.size, it.colour, it.coverage].filter(Boolean).join(' · ')
const statusLabel = (s) => (s === 'paid' ? 'Paid' : s === 'pending' ? 'Awaiting payment' : s)
</script>
