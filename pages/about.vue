<template>
  <div>
    <section class="border-b border-ink/10 bg-shell/60">
      <div class="container-bm py-16 md:py-20 text-center">
        <FancyHeading eyebrow="Our Story" title="Swimwear with *Island Soul*" center size="lg" />
      </div>
    </section>

    <section class="section container-bm grid gap-12 md:grid-cols-2">
      <div class="space-y-5 text-lg leading-relaxed text-ink/75">
        <p>
          Bahama Mama Swimwear began with a simple frustration: swimwear that never quite fit, and
          never quite felt like <em>us</em>. So we started making our own — one suit at a time, cut
          to measure, on a small island where the sea is part of daily life.
        </p>
        <p>
          Today every piece is still made to order. Nothing sits in a warehouse. When you order, we
          draft the pattern, choose the fabric and sew it for your body — whether that's a size from
          our range or a fully custom commission.
        </p>
        <p>
          Our promise is affordable luxury: the fit, finish and fabric of a designer suit, made
          honestly and priced fairly, by a team that genuinely loves this work.
        </p>
      </div>
      <div class="relative">
        <div class="aspect-[3/4] w-4/5 rounded-4xl bg-gradient-to-br from-ink to-coral shadow-card">
          <img
            src="https://picsum.photos/seed/bahama-story-1/800/1040"
            alt="Caribbean beach"
            class="h-full w-full rounded-4xl object-cover opacity-85"
          />
        </div>
        <div class="absolute -bottom-8 right-0 aspect-square w-1/2 rounded-4xl bg-blush shadow-soft">
          <img
            src="https://picsum.photos/seed/bahama-story-2/600/600"
            alt="Studio detail"
            class="h-full w-full rounded-4xl object-cover"
          />
        </div>
      </div>
    </section>

    <section class="bg-shell/60 py-16 md:py-24">
      <div class="container-bm grid gap-8 md:grid-cols-3">
        <div v-for="s in stats" :key="s.label" class="text-center">
          <div class="font-display text-4xl font-semibold text-coral">{{ s.value }}</div>
          <div class="mt-2 text-[0.7rem] uppercase tracking-widest2 text-ink/45">{{ s.label }}</div>
        </div>
      </div>
    </section>

    <section class="section container-bm text-center">
      <h2 class="font-display text-3xl font-semibold text-ink md:text-4xl">
        Come find your <span class="fancy-accent">fit</span>
      </h2>
      <div class="mt-8 flex flex-wrap justify-center gap-4">
        <NuxtLink to="/shop" class="btn-primary shadow-soft">Shop the collection</NuxtLink>
        <NuxtLink to="/contact" class="btn-outline">Get in touch</NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup>
const stats = [
  { value: '2018', label: 'Founded on-island' },
  { value: '4,000+', label: 'Suits made to order' },
  { value: '30+', label: 'Countries shipped to' }
]
</script>
