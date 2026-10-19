/**
 * Public fabric palette for the Bikini Mix builder. Same real-endpoint-
 * first, mock-fallback-only-on-503 architecture as useBikiniMixEvent.js —
 * once the migration is applied and the admin opts fabrics in via
 * pages/admin/bikini-mix/fabrics.vue, this switches to real data with no
 * frontend changes.
 *
 * The mock list below is clearly-labelled placeholder swatches for
 * previewing the builder UI only — not a claim about real inventory.
 */
const MOCK_FABRICS = [
  { id: 'mock-sunset-coral', name: 'Sunset Coral', hexColor: '#E66B45', imageUrl: null },
  { id: 'mock-lagoon-teal', name: 'Lagoon Teal', hexColor: '#2E8B8B', imageUrl: null },
  { id: 'mock-blush-pink', name: 'Blush Pink', hexColor: '#F2A9B6', imageUrl: null },
  { id: 'mock-island-gold', name: 'Island Gold', hexColor: '#D9A441', imageUrl: null },
  { id: 'mock-deep-rose', name: 'Deep Rose', hexColor: '#D06B8E', imageUrl: null },
  { id: 'mock-palm-green', name: 'Palm Green', hexColor: '#3F7A52', imageUrl: null },
  { id: 'mock-midnight-navy', name: 'Midnight Navy', hexColor: '#28344A', imageUrl: null },
  { id: 'mock-cream-white', name: 'Cream White', hexColor: '#F2E9D8', imageUrl: null }
]

export async function useBikiniMixFabrics() {
  const { data, pending, error } = await useLazyAsyncData(
    'bikini-mix-public-fabrics',
    () => $fetch('/api/bikini-mix/fabrics').catch(() => ({ configured: false })),
    { server: false }
  )

  const fabrics = computed(() => (data.value?.configured ? data.value.fabrics : MOCK_FABRICS))
  const isMock = computed(() => !data.value?.configured)

  return { fabrics, isMock, pending, error }
}
