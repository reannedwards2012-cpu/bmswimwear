<template>
  <div>
    <FancyHeading eyebrow="Admin" title="*Products*" size="sm" as="h1" />
    <div class="mt-8 rounded-4xl bg-cream p-10 text-center shadow-card">
      <p class="text-sm text-ink/60">Product management coming next.</p>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Products — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })
</script>
