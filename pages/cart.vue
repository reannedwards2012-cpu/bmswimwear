<template>
  <div class="section container-bm">
    <p class="eyebrow">Your bag</p>
    <h1 class="mt-2 font-display text-3xl font-semibold text-ink md:text-4xl">Shopping Cart</h1>

    <!-- empty -->
    <div v-if="!items.length" class="mt-10 rounded-4xl bg-shell/60 p-10 text-center">
      <p class="text-ink/70">Your cart is empty.</p>
      <NuxtLink to="/shop" class="btn-primary mt-6">Shop swimwear</NuxtLink>
    </div>

    <!-- filled -->
    <div v-else class="mt-10 grid gap-10 lg:grid-cols-[1fr_20rem] lg:gap-16">
      <!-- lines -->
      <ul class="divide-y divide-ink/10 border-y border-ink/10">
        <li v-for="item in items" :key="item.lineId" class="flex gap-4 py-6 sm:gap-6">
          <NuxtLink :to="`/shop/${item.productId}`" class="shrink-0">
            <img
              :src="item.image"
              :alt="item.name"
              class="aspect-[3/4] w-24 rounded-2xl object-cover sm:w-28"
            />
          </NuxtLink>

          <div class="flex min-w-0 flex-1 flex-col">
            <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
              <NuxtLink
                :to="`/shop/${item.productId}`"
                class="font-display text-lg font-medium text-ink hover:text-coral"
              >
                {{ item.name }}
              </NuxtLink>
              <p class="text-sm font-semibold text-ink">{{ money(item.priceUsd * item.quantity) }}</p>
            </div>

            <dl class="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink/55">
              <div v-if="item.size" class="flex gap-1">
                <dt>Size:</dt><dd class="text-ink/75">{{ item.size }}</dd>
              </div>
              <div v-if="item.colourName" class="flex gap-1">
                <dt>Colour:</dt><dd class="text-ink/75">{{ item.colourName }}</dd>
              </div>
              <div v-if="item.coverage" class="flex gap-1">
                <dt>Coverage:</dt><dd class="text-ink/75">{{ item.coverage }}</dd>
              </div>
            </dl>

            <div class="mt-auto flex items-center gap-2 pt-4">
              <div class="flex items-center rounded-full border border-ink/15">
                <button
                  type="button"
                  class="grid h-9 w-9 place-items-center rounded-full text-ink/70 transition-colors hover:text-ink disabled:opacity-30 disabled:hover:text-ink/70"
                  :disabled="item.quantity <= 1"
                  :aria-label="`Decrease ${item.name} quantity`"
                  @click="decrement(item.lineId)"
                >
                  &minus;
                </button>
                <span class="min-w-[2ch] text-center text-sm font-semibold text-ink">{{ item.quantity }}</span>
                <button
                  type="button"
                  class="grid h-9 w-9 place-items-center rounded-full text-ink/70 transition-colors hover:text-ink"
                  :aria-label="`Increase ${item.name} quantity`"
                  @click="increment(item.lineId)"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                class="grid h-9 w-9 place-items-center rounded-full text-ink/50 transition-colors hover:bg-shell hover:text-coral"
                :aria-label="`Remove ${item.name} from cart`"
                @click="removeItem(item.lineId)"
              >
                <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M4 7h16" stroke-linecap="round" />
                  <path d="M10 11v6M14 11v6" stroke-linecap="round" />
                  <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke-linejoin="round" />
                  <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </li>
      </ul>

      <!-- summary -->
      <aside class="h-fit rounded-4xl bg-shell/60 p-6 lg:sticky lg:top-28">
        <h2 class="font-display text-xl font-semibold text-ink">Summary</h2>
        <div class="mt-4 flex items-center justify-between border-t border-ink/10 pt-4 text-sm">
          <span class="text-ink/60">Subtotal</span>
          <span class="font-semibold text-ink">USD {{ money(subtotalUsd) }}</span>
        </div>
        <p class="mt-2 text-xs text-ink/45">Made to order · {{ turnaround }}. Shipping calculated at checkout.</p>

        <NuxtLink to="/checkout" class="btn-primary mt-6 block w-full text-center shadow-soft">
          Checkout
        </NuxtLink>

        <NuxtLink to="/shop" class="mt-4 block text-center text-xs font-semibold uppercase tracking-widest2 text-ink/50 hover:text-ink">
          Continue shopping
        </NuxtLink>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { MADE_TO_ORDER } from '~/data/products.js'
import { formatUsd } from '~/utils/money'

useHead({ title: 'Shopping Cart — Bahama Mama Swimwear' })

const { items, subtotalUsd, increment, decrement, removeItem } = useCart()

const turnaround = MADE_TO_ORDER.turnaround
const money = formatUsd
</script>
