<template>
  <section class="relative overflow-hidden bg-sand">
    <!-- soft island glow -->
    <div class="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-blush/30 blur-3xl" aria-hidden="true" />
    <div class="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-coral/15 blur-3xl" aria-hidden="true" />

    <div class="container-bm relative grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
      <div class="relative z-10">
        <p class="inline-flex items-center gap-2 rounded-full bg-cream px-4 py-1.5 text-xs font-semibold uppercase tracking-widest2 text-coral shadow-sm">
          🌴 Made in the Caribbean
        </p>
        <h1 class="mt-5 font-display text-5xl font-semibold leading-[1.02] text-ink md:text-7xl">
          A More <span class="fancy-accent">Personal</span> Kind of Swimwear
        </h1>
        <p class="mt-6 max-w-md text-lg leading-relaxed text-ink/70">
          Swimwear designed and handmade in Grenada for beach days, boat rides,
          Carnival and everything the Caribbean calls for. Shop ready-to-wear
          pieces or have something custom made just for you.
        </p>
        <div class="mt-9 flex flex-wrap gap-4">
          <NuxtLink to="/shop" class="btn-primary shadow-soft">SHOP SWIMWEAR</NuxtLink>
          <NuxtLink to="/contact" class="btn-outline">GO CUSTOM</NuxtLink>
        </div>
      </div>

      <div class="relative">
        <div class="relative grid grid-cols-2 gap-4">
          <img
            src="/images/site/hero-1.jpg"
            alt="Bahama Mama red one-piece on the beach at golden hour"
            class="mt-10 aspect-[3/4] w-full rounded-4xl object-cover shadow-card"
          />
          <img
            src="/images/site/hero-2.jpg"
            alt="Bahama Mama cut-out one-piece on the beach at sunset"
            class="aspect-[3/4] w-full rounded-4xl object-cover shadow-card"
          />
        </div>
      </div>
    </div>
  </section>
</template>
