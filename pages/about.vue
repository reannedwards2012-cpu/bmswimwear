<template>
  <div>
    <section class="border-b border-ink/10 bg-shell/50">
      <div class="container-bm py-16 md:py-20">
        <p class="eyebrow">Our story</p>
        <h1 class="mt-3 font-display text-4xl font-semibold text-ink md:text-5xl">
          Swimwear with island soul
        </h1>
      </div>
    </section>

    <section class="container-bm grid gap-12 py-16 md:grid-cols-2 md:py-24">
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
      <div class="grid grid-cols-2 gap-4">
        <img
          src="https://images.unsplash.com/photo-1526401485004-46910ecc8e51?w=700&q=80&auto=format&fit=crop"
          alt="Caribbean beach"
          class="aspect-[3/4] w-full rounded-2xl object-cover"
        />
        <img
          src="https://images.unsplash.com/photo-1556740738-b6a63e27c4df?w=700&q=80&auto=format&fit=crop"
          alt="Studio detail"
          class="mt-10 aspect-[3/4] w-full rounded-2xl object-cover"
        />
      </div>
    </section>

    <section class="bg-shell/60 py-16 md:py-24">
      <div class="container-bm grid gap-8 md:grid-cols-3">
        <div v-for="s in stats" :key="s.label" class="text-center">
          <div class="font-display text-4xl font-semibold text-ocean">{{ s.value }}</div>
          <div class="mt-2 text-sm uppercase tracking-widest2 text-ink/45">{{ s.label }}</div>
        </div>
      </div>
    </section>

    <section class="container-bm py-16 text-center md:py-24">
      <h2 class="font-display text-3xl font-semibold text-ink md:text-4xl">Come find your fit</h2>
      <div class="mt-8 flex flex-wrap justify-center gap-4">
        <NuxtLink to="/shop" class="btn-primary">Shop the collection</NuxtLink>
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
