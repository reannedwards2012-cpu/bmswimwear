/**
 * Public fabric palette for the Bikini Mix builder. Reads the real endpoint
 * (server/api/bikini-mix/fabrics.get.js) only — the fabrics the admin has
 * opted in to the builder. No mock fallback: if the fetch fails, `error`
 * is left set so the page can show a real error state with a retry
 * option instead of silently substituting placeholder swatches.
 */
export async function useBikiniMixFabrics() {
  const { data, pending, error, refresh } = await useLazyAsyncData('bikini-mix-public-fabrics', () => $fetch('/api/bikini-mix/fabrics'), {
    server: false
  })

  const fabrics = computed(() => data.value?.fabrics ?? [])

  return { fabrics, pending, error, refresh }
}
