<template>
  <div>
    <section class="border-b border-ink/10 bg-shell/60">
      <div class="container-bm py-16 md:py-20 text-center">
        <FancyHeading eyebrow="Our Story" title="A Love for *Swimwear*" center size="lg" />
      </div>
    </section>

    <section class="section container-bm grid gap-12 md:grid-cols-2">
      <div class="space-y-5 text-lg leading-relaxed text-ink/75">
        <p>
          I've loved swimsuits for as long as I can remember. Growing up in Grenada, there weren't
          many places to find them, and even when I did, they weren't always quite what I had in mind.
        </p>
        <p>
          I was already hand sewing little adjustments to my clothes when my mom surprised me with a
          sewing machine one Christmas. Naturally, I decided to make a swimsuit. A few YouTube videos
          later, I had my first one. It wasn't perfect, but I was hooked. There was something about
          imagining exactly what I wanted and being able to make it exist.
        </p>
        <p>
          That feeling is still a big part of Bahama Mama today. Sometimes you can't find the style
          you want. Sometimes the fit just isn't right. Sometimes you want something made with you in
          mind.
        </p>
        <p>
          So whether you fall in love with one of our designs or have something made completely your
          own, that's what Bahama Mama is here for.
        </p>
        <p>Put it on and feel yourself.</p>
      </div>
      <div class="relative">
        <div class="aspect-[3/4] w-4/5 rounded-4xl bg-shell shadow-card">
          <img
            src="/images/site/about-1.jpg"
            alt="Cutting a swimsuit on a dress form in the studio"
            class="h-full w-full rounded-4xl object-cover"
          />
        </div>
        <div class="absolute -bottom-8 right-0 aspect-square w-1/2 rounded-4xl bg-blush shadow-soft">
          <img
            src="/images/site/about-2.jpg"
            alt="The founder as a child in a swimsuit"
            class="h-full w-full rounded-4xl object-cover"
          />
        </div>
      </div>
    </section>

    <BrandPillars />

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

