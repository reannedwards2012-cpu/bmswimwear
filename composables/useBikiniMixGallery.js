/**
 * Customization gallery images for The Swimsuit Mixer builder — mirrors
 * useBikiniMixFabrics.js's fetch-composable shape exactly. No mock
 * fallback: a failed fetch just means the "See What You Can Customize"
 * overlay shows its own error state, never silently substituted content.
 */
export async function useBikiniMixGallery() {
  const { data, pending, error, refresh } = await useLazyAsyncData('bikini-mix-public-gallery', () => $fetch('/api/bikini-mix/gallery'), {
    server: false,
    immediate: false
  })

  const images = computed(() => data.value?.images ?? [])

  return { images, pending, error, refresh }
}
