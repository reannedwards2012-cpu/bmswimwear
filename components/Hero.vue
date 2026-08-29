<template>
  <section class="relative overflow-hidden bg-sand">
    <!-- soft island glow -->
    <div class="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-blush/30 blur-3xl" aria-hidden="true" />
    <div class="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-coral/15 blur-3xl" aria-hidden="true" />

    <div class="container-bm relative grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
      <div class="relative z-10">
        <p class="inline-flex items-center gap-2 rounded-full bg-cream px-4 py-1.5 text-xs font-semibold uppercase tracking-widest2 text-coral shadow-sm">
          🌴 Handmade in the Caribbean
        </p>
        <h1 class="mt-5 font-display text-5xl font-semibold leading-[1.02] text-ink md:text-7xl">
          Made for
          <span class="mt-1 block fancy-accent text-6xl md:text-[5.5rem]">Island Days</span>
        </h1>
        <p class="mt-6 max-w-md text-lg leading-relaxed text-ink/70">
          Hand-cut, made-to-order and fully custom swimwear — designed to hug your
          curves and made to feel like a little luxury every time you wear it.
        </p>
        <div class="mt-9 flex flex-wrap gap-4">
          <NuxtLink to="/shop" class="btn-primary shadow-soft">Shop the collection</NuxtLink>
          <NuxtLink to="/contact" class="btn-outline">Design your own</NuxtLink>
        </div>
        <p class="mt-6 font-script text-2xl text-rose">confident · feminine · a little bit extra</p>
      </div>

      <div class="relative">
        <div class="relative grid grid-cols-2 gap-4">
          <img
            src="https://picsum.photos/seed/bahama-hero-1/800/1040"
            alt="Model wearing Bahama Mama swimwear"
            class="mt-10 aspect-[3/4] w-full rounded-4xl object-cover shadow-card"
          />
          <img
            src="https://picsum.photos/seed/bahama-hero-2/800/1040"
            alt="Caribbean shoreline"
            class="aspect-[3/4] w-full rounded-4xl object-cover shadow-card"
          />
        </div>
        <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-cream px-5 py-2 text-center text-xs font-semibold uppercase tracking-widest2 text-ink shadow-soft">
          🐚 Fits XS–3X · every body
        </div>
      </div>
    </div>
  </section>
</template>
