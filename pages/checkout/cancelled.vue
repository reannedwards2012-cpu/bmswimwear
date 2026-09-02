<template>
  <div class="section container-bm">
    <div class="mx-auto max-w-lg text-center">
      <p class="eyebrow">Checkout</p>
      <h1 class="mt-2 font-display text-3xl font-semibold text-ink md:text-4xl">
        Payment not completed
      </h1>
      <p class="mt-4 leading-relaxed text-ink/70">
        Your payment wasn’t completed, so you haven’t been charged. Your order details
        are saved — you can pick up where you left off.
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <NuxtLink to="/checkout" class="btn-primary">Return to checkout</NuxtLink>
        <NuxtLink to="/cart" class="btn-outline">Review cart</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
useHead({ title: 'Payment not completed — Bahama Mama Swimwear' })
</script>
