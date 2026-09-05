<template>
  <section class="relative overflow-hidden bg-sand">
    <!-- soft island glow -->
    <div class="pointer-events-none absolute -left-24 top-6 h-80 w-80 rounded-full bg-blush/30 blur-3xl" aria-hidden="true" />
    <div class="pointer-events-none absolute -right-20 bottom-0 h-[26rem] w-[26rem] rounded-full bg-coral/15 blur-3xl" aria-hidden="true" />

    <div class="container-bm relative grid items-center gap-10 py-16 md:grid-cols-[0.78fr_1fr] md:gap-8 md:py-24 lg:grid-cols-[0.7fr_1fr] lg:gap-14 lg:py-28">
      <div class="relative z-10">
        <p class="inline-flex items-center gap-2 rounded-full bg-cream px-4 py-1.5 text-xs font-semibold uppercase tracking-widest2 text-coral shadow-sm">
          🌴 Made in the Caribbean
        </p>
        <h1 class="mt-5 font-display text-5xl font-semibold leading-[1.02] text-ink md:text-7xl lg:text-[5.25rem]">
          A More <span class="fancy-accent">Personal</span> Kind of Swimwear
        </h1>
        <p class="mt-6 max-w-md text-lg leading-relaxed text-ink/70">
          Swimwear designed and handmade in Grenada for beach days, boat rides,
          Carnival and everything the Caribbean calls for. Shop ready-to-wear
          pieces or have something custom made just for you.
        </p>
        <div class="mt-9 flex flex-wrap gap-4">
          <NuxtLink to="/shop" class="btn-primary shadow-soft">SHOP SWIMWEAR</NuxtLink>
          <NuxtLink to="/contact?subject=custom" class="btn-outline">GO CUSTOM</NuxtLink>
        </div>
      </div>

      <div class="relative md:-mr-4 lg:-mr-12">
        <div class="grid grid-cols-2 gap-4 lg:gap-5">
          <img
            src="/images/site/hero-3.jpg"
            alt="Bahama Mama turquoise bell-sleeve one-piece on a Grenada balcony"
            class="mt-12 aspect-[3/4] w-full rounded-4xl object-cover shadow-soft lg:mt-20"
          />
          <img
            src="/images/site/hero-2.jpg"
            alt="Bahama Mama cut-out one-piece on the beach at sunset"
            class="aspect-[3/4] w-full rounded-4xl object-cover shadow-soft"
          />
        </div>
      </div>
    </div>
  </section>
</template>
