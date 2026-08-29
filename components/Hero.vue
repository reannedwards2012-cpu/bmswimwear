<template>
  <section class="relative overflow-hidden bg-sand">
    <div class="container-bm grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
      <div class="relative z-10">
        <p class="eyebrow">Caribbean swimwear · Made to order</p>
        <h1 class="mt-4 font-display text-4xl font-semibold leading-[1.05] text-ink md:text-6xl">
          Made for
          <span class="mt-1 block font-script text-5xl font-normal text-ocean md:text-7xl">Island Days</span>
        </h1>
        <p class="mt-6 max-w-md text-lg leading-relaxed text-ink/70">
          High-quality, made-to-order and custom swimwear — cut to fit you and finished by hand in
          the Caribbean. Affordable luxury for wherever the water takes you.
        </p>
        <div class="mt-9 flex flex-wrap gap-4">
          <NuxtLink to="/shop" class="btn-primary">Shop the collection</NuxtLink>
          <NuxtLink to="/contact" class="btn-outline">Start a custom piece</NuxtLink>
        </div>
        <dl class="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-ink/10 pt-6">
          <div>
            <dt class="font-display text-2xl text-ink">100%</dt>
            <dd class="text-xs uppercase tracking-widest2 text-ink/40">Made to order</dd>
          </div>
          <div>
            <dt class="font-display text-2xl text-ink">XS–3X</dt>
            <dd class="text-xs uppercase tracking-widest2 text-ink/40">Every body</dd>
          </div>
          <div>
            <dt class="font-display text-2xl text-ink">Global</dt>
            <dd class="text-xs uppercase tracking-widest2 text-ink/40">Shipping</dd>
          </div>
        </dl>
      </div>

      <div class="relative">
        <div class="absolute -right-10 -top-10 h-72 w-72 rounded-full bg-coral/15 blur-3xl" aria-hidden="true" />
        <div class="absolute -bottom-12 -left-8 h-64 w-64 rounded-full bg-blush/25 blur-3xl" aria-hidden="true" />
        <div class="relative grid grid-cols-2 gap-4">
          <img
            src="https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?w=800&q=80&auto=format&fit=crop"
            alt="Model wearing Bahama Mama swimwear on the beach"
            class="mt-8 aspect-[3/4] w-full rounded-2xl object-cover"
          />
          <img
            src="https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80&auto=format&fit=crop"
            alt="Caribbean coastline"
            class="aspect-[3/4] w-full rounded-2xl object-cover"
          />
        </div>
      </div>
    </div>
  </section>
</template>
