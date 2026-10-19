<template>
  <div class="min-h-screen bg-sand">
    <div class="section container-bm max-w-2xl !pb-28">
      <FancyHeading eyebrow="The Bikini Mixer" title="Booking *Terms*" center>
        The complete cancellation and refund policy for The Bikini Mixer by Bahama Mama.
      </FancyHeading>

      <div class="mt-9 space-y-6 rounded-4xl bg-cream p-7 shadow-card sm:p-9">
        <section>
          <h2 class="font-display text-base font-semibold text-ink">Cancellation &amp; Refund Policy</h2>
          <div class="mt-3 space-y-2.5 text-sm leading-relaxed text-ink/70">
            <p>Full payment is required to secure a booking.</p>
            <p><strong class="text-ink">Cancellations on or before November 20, 2026:</strong> Customers receive a 50% refund of their ticket price.</p>
            <p><strong class="text-ink">Cancellations after November 20, 2026:</strong> No refund will be issued.</p>
            <p><strong class="text-ink">If Bahama Mama cancels the event:</strong> Customers receive a full refund.</p>
            <p><strong class="text-ink">Refund processing:</strong> Approved refunds will be initiated within 7 business days. The time taken for the funds to appear in your account may vary depending on your bank or payment provider.</p>
            <p class="text-xs text-ink/50">For clarity, 50% of the full ticket price is non-refundable upon customer cancellation. This is not a deposit arrangement.</p>
          </div>
        </section>

        <section class="border-t border-ink/10 pt-6">
          <h2 class="font-display text-base font-semibold text-ink">Your Bikini Selections</h2>
          <p class="mt-3 text-sm leading-relaxed text-ink/70">
            Your bikini pieces will be prepared based on your booking selections, so please choose carefully.
            Selections are final once payment is completed. Limited swaps may be possible at the event, subject to
            availability.
          </p>
        </section>
      </div>

      <div class="mt-8 flex justify-center">
        <NuxtLink to="/bikini-mix" class="btn-outline">← Back to Booking</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
useHead({ title: 'Booking Terms — The Bikini Mixer' })
</script>
