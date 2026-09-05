/**
 * Storefront product reads — Supabase-backed (Phase C), replacing the old
 * static data/products.js imports.
 *
 * `useProductList()` fetches the full active catalogue once and dedupes
 * across pages via the shared key, so navigating home → shop doesn't refetch.
 * Category filtering / "related" slicing stays client-side in each page,
 * exactly as it was with the static array.
 */
import { computed } from 'vue'

export function useProductList() {
  const { data, pending, error, refresh } = useFetch('/api/products', {
    key: 'product-list',
    default: () => ({ products: [] })
  })
  const products = computed(() => data.value?.products ?? [])
  return { products, pending, error, refresh }
}
