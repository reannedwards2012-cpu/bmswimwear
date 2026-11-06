import { computed, ref } from 'vue'

/**
 * Shared bulk-selection state for admin list pages (Inquiries, Orders,
 * Fabric Inventory, Products, Swimsuit Mixer Bookings, Gallery). Selection
 * is deliberately scoped to whatever rows are CURRENTLY displayed — never
 * an implicit "select everything matching this filter" — so `itemsRef`
 * should be the same computed list the page already renders (after
 * filtering/pagination), not the full unfiltered dataset.
 *
 * Callers must clear() whenever filters, search, or pagination change (see
 * each page's watcher) — this composable doesn't watch itemsRef itself,
 * since "a row scrolled out of the currently-loaded set" and "the admin
 * explicitly changed the filter" are different events call sites need to
 * tell apart.
 *
 * @param {import('vue').Ref<Array<Record<string, any>>>} itemsRef
 * @param {string} idKey
 */
export function useAdminBulkSelection(itemsRef, idKey = 'id') {
  const selectedIds = ref(new Set())

  function toggle(id) {
    const next = new Set(selectedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedIds.value = next
  }

  function remove(id) {
    if (!selectedIds.value.has(id)) return
    const next = new Set(selectedIds.value)
    next.delete(id)
    selectedIds.value = next
  }

  function clear() {
    selectedIds.value = new Set()
  }

  const allSelected = computed(
    () => itemsRef.value.length > 0 && itemsRef.value.every((it) => selectedIds.value.has(it[idKey]))
  )
  const someSelected = computed(() => itemsRef.value.some((it) => selectedIds.value.has(it[idKey])))
  const indeterminate = computed(() => someSelected.value && !allSelected.value)

  function toggleAll() {
    const next = new Set(selectedIds.value)
    if (allSelected.value) {
      for (const it of itemsRef.value) next.delete(it[idKey])
    } else {
      for (const it of itemsRef.value) next.add(it[idKey])
    }
    selectedIds.value = next
  }

  return {
    selectedIds,
    selectedCount: computed(() => selectedIds.value.size),
    toggle,
    remove,
    clear,
    allSelected,
    someSelected,
    indeterminate,
    toggleAll
  }
}
