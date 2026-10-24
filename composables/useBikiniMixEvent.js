/**
 * The Bikini Mix event config for the customer-facing pages.
 *
 * Reads the real endpoint (server/api/bikini-mix/event.get.js) only — the
 * same live bikini_mix_event row the admin Settings page edits. No mock
 * fallback: if the fetch fails, `error` is left set (never swallowed) so
 * the page can show a real error state with a retry option instead of
 * silently substituting placeholder data. See pages/bikini-mix/index.vue.
 */
export async function useBikiniMixEvent() {
  const { data, pending, error, refresh } = await useLazyAsyncData('bikini-mix-public-event', () => $fetch('/api/bikini-mix/event'), {
    server: false
  })

  const event = computed(() => data.value?.event ?? null)

  return { event, pending, error, refresh }
}
