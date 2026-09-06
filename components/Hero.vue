<template>
  <!--
    Editorial hero: ONE large, portrait-oriented image on the left, the
    existing content panel on the right. Copy, links, buttons, colours and
    typography are unchanged — only the layout/presentation.
      · desktop: image left (~52%), content right (~48%), content vertically centred
      · mobile:  one full-width portrait image on top, content section beneath (bg-sand)
    Begins directly below the header (no top spacing of its own).
  -->
  <section class="relative isolate overflow-hidden bg-sand">
    <!-- existing soft island glow — unchanged brand colours -->
    <div class="pointer-events-none absolute -left-24 top-6 h-80 w-80 rounded-full bg-blush/30 blur-3xl" aria-hidden="true" />
    <div class="pointer-events-none absolute -right-20 bottom-0 h-[26rem] w-[26rem] rounded-full bg-coral/15 blur-3xl" aria-hidden="true" />

    <div class="relative lg:grid lg:min-h-[46rem] lg:grid-cols-[52fr_48fr] xl:min-h-[50rem]">
      <!-- ── image (single, portrait) ──
           On lg the picture is absolutely-positioned and object-cover so the
           frame stays tall/editorial and object-position keeps the swimsuit
           and torso in view rather than sky. -->
      <div class="relative">
        <img
          src="/images/site/hero-3.jpg"
          alt="Bahama Mama turquoise bell-sleeve one-piece on a Grenada balcony"
          class="aspect-[4/5] w-full object-cover object-[50%_26%] sm:aspect-auto sm:h-[30rem] md:h-[34rem] lg:absolute lg:inset-0 lg:h-full lg:object-[50%_30%]"
        />
      </div>

      <!-- ── content ── -->
      <div class="relative isolate flex items-center bg-sand">
        <!-- brand detail: the soft shadow of a coconut frond thrown in from
             beyond the top-right corner. It is allowed to spill past this
             panel; only the hero <section>'s own overflow-hidden clips it, so
             the leaflets taper off naturally instead of along a straight edge.
             (Mobile keeps a panel-level clip — the frond sits tucked in the
             top-right there and the image above is a real visual seam.) -->
        <div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden lg:overflow-visible" aria-hidden="true">
          <PalmShadow position="hero" tone="dark" />
        </div>

        <div class="mx-auto w-full max-w-lg px-6 py-12 sm:py-14 lg:px-14 lg:py-16 xl:px-20">
          <p class="inline-flex items-center gap-2 rounded-full bg-cream px-4 py-1.5 text-xs font-semibold uppercase tracking-widest2 text-coral shadow-sm">
            🌴 Made in the Caribbean
          </p>
          <h1 class="mt-5 font-display text-[2.45rem] font-semibold leading-[1.05] text-ink sm:text-5xl lg:text-[2.8rem] xl:text-[3.25rem]">
            A More <span class="fancy-accent">Personal</span> Kind of Swimwear
          </h1>
          <p class="mt-5 max-w-md text-base leading-relaxed text-ink/70 sm:text-lg">
            Swimwear designed and handmade in Grenada for beach days, boat rides,
            Carnival and everything the Caribbean calls for. Shop ready-to-wear
            pieces or have something custom made just for you.
          </p>
          <div class="mt-8 flex flex-wrap gap-4">
            <NuxtLink to="/shop" class="btn-primary shadow-soft">SHOP SWIMWEAR</NuxtLink>
            <NuxtLink to="/contact?subject=custom" class="btn-outline">GO CUSTOM</NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
