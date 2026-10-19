<template>
  <div class="min-h-screen bg-sand">
    <div class="section container-bm">
      <div class="mx-auto max-w-lg text-center">
        <p class="eyebrow">The Bikini Mixer</p>
        <h1 class="mt-2 font-display text-3xl font-semibold text-ink md:text-4xl">Payment Not Completed</h1>
        <p class="mt-4 leading-relaxed text-ink/70">
          Your payment wasn't completed, so you haven't been charged. Your hold is still saved for a little while —
          you can pick up right where you left off.
        </p>
        <div class="mt-8 flex flex-wrap justify-center gap-3">
          <NuxtLink to="/bikini-mix" class="btn-primary">Return to booking</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
useHead({ title: 'Payment not completed — The Bikini Mixer' })
</script>
