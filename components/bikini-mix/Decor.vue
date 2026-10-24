<template>
  <div class="bm-decor" aria-hidden="true" />
</template>

<script setup>
// Purely decorative background overlay for the Bikini Mixer booking page —
// a pre-composed image (beads, charms, shells, flowers framing a
// transparent centre), rendered via background-size: cover so it always
// fills the viewport edge-to-edge with no empty space, at the cost of
// cropping whichever axis doesn't match the viewport's aspect ratio (the
// content lives in the corners, so a mismatched aspect ratio crops into
// those corners first — a deliberate trade-off, chosen over the
// letterboxing/gutter-math alternatives tried earlier).
//
// Two source images, not one: the desktop image is landscape (16:9) and
// crops hard on phone-shaped viewports, since cover crops from the
// centre outward and a 16:9 image is almost all centre once squeezed
// into a ~9:19.5 phone screen. Below 768px this swaps to a second image
// composed specifically in portrait (1080x2340, ~9:19.5 — matching
// common phone aspect ratios) with its own corner clusters, so cover
// crops minimally there too instead of erasing the artwork.
//
// position: fixed, pointer-events: none, low z-index — stays put while
// the page scrolls over it, strictly decorative, never intercepts
// clicks or taps.
</script>

<style scoped>
.bm-decor {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image: url('/images/bikini-mix/decor-overlay.webp');
  background-repeat: no-repeat;
  background-position: center center;
  background-size: cover;
}

@media (max-width: 767px) {
  .bm-decor {
    background-image: url('/images/bikini-mix/decor-overlay-mobile.webp');
  }
}
</style>
