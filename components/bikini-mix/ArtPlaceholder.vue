<template>
  <!-- Development-only "art not supplied yet" placeholder — see the
       `missing: true` entries in data/bikiniMixArt.js. Renders a clearly
       labeled, honest placeholder instead of guessing a shape or silently
       reusing an unrelated piece. Must never reach the deployed site with
       a real customer looking at it; swap the referenced art key for real
       traced path data the moment it's supplied and this stops rendering
       entirely on its own (the parent component's `missing` check). -->
  <div
    class="grid place-items-center rounded-2xl border-2 border-dashed border-ink/20 bg-cream/60 text-center"
    :style="{ width: width + 'px', height: height + 'px', backgroundColor: colour ? `${colour}22` : undefined }"
  >
    <div class="px-2">
      <p class="text-[0.6rem] font-semibold uppercase tracking-widest2 text-ink/40">Preview</p>
      <p class="text-[0.65rem] font-semibold text-ink/55">coming soon</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  width: { type: Number, default: 200 },
  height: { type: Number, default: 200 },
  colour: { type: String, default: null }
})
</script>
