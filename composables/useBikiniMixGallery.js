/**
 * Customization gallery images for The Swimsuit Mixer — mirrors
 * useBikiniMixFabrics.js's fetch-composable shape exactly. Fetches
 * immediately (client-side only) since the "Get Inspired" gallery section
 * is always visible on the page now, not a popup opened on demand. No mock
 * fallback: a failed fetch just means the gallery section shows its own
 * error state, never silently substituted content.
 */
export async function useBikiniMixGallery() {
  const { data, pending, error, refresh } = await useLazyAsyncData('bikini-mix-public-gallery', () => $fetch('/api/bikini-mix/gallery'), {
    server: false
  })

  const images = computed(() => data.value?.images ?? [])

  return { images, pending, error, refresh }
}
