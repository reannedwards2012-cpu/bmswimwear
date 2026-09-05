/**
 * Builds the authoritative product catalogue that server/utils/checkoutOrder.js
 * validates a cart against — the Supabase replacement for
 * data/products.js's `getProductById()`.
 *
 * Returns a Map<slug, catalogueEntry> whose entries have the SAME shape
 * buildValidatedOrder() already expects — { id, title, image, price,
 * priceXcd (dollars), sizes[], coverage[], colours:[{id,name}] } — so the
 * validator itself needed only a one-line change (getProductById -> lookup).
 *
 * All the "is the selected fabric still OK?" rules the Phase C brief asks
 * for are enforced HERE, by which rows make it into `colours`:
 *   - product.is_active = true              (else the product isn't in the map at all)
 *   - product_fabrics.is_available = true
 *   - fabrics.is_active = true
 *   - fabrics.status <> 'unavailable'
 * An inactive product / unavailable fabric therefore just isn't found, and
 * buildValidatedOrder rejects it with its existing user-facing message.
 * Nothing about the validator's branching changes.
 *
 * Throws on a Supabase error — the caller (checkout.post.js) already wraps
 * everything in a try/catch that returns the generic 500.
 */
export async function fetchCatalogueForCheckout(supabase, productSlugs) {
  const slugs = [...new Set((productSlugs ?? []).filter((s) => typeof s === 'string' && s))]
  const catalogue = new Map()
  if (slugs.length === 0) return catalogue

  const { data, error } = await supabase
    .from('products')
    .select(`
      slug, name, price_usd_cents, price_xcd_cents,
      product_sizes(size),
      product_coverages(coverage),
      product_images(image_url, sort_order, is_primary),
      product_fabrics(is_available, fabrics(slug, name, is_active, status))
    `)
    .in('slug', slugs)
    .eq('is_active', true)

  if (error) throw new Error(`catalogue fetch failed: ${error.message}`)

  for (const row of data ?? []) {
    const colours = (row.product_fabrics ?? [])
      .filter(
        (pf) =>
          pf.is_available === true &&
          pf.fabrics &&
          pf.fabrics.is_active === true &&
          pf.fabrics.status !== 'unavailable'
      )
      .map((pf) => ({ id: pf.fabrics.slug, name: pf.fabrics.name }))

    // Snapshot image for order_items — primary, else lowest sort_order, else null.
    const imgs = row.product_images ?? []
    const primary = imgs.find((i) => i.is_primary)
    const image = primary
      ? primary.image_url
      : imgs.length
        ? [...imgs].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0].image_url
        : null

    catalogue.set(row.slug, {
      id: row.slug,
      title: row.name,
      image,
      price: row.price_usd_cents / 100,
      priceXcd: row.price_xcd_cents / 100,
      sizes: (row.product_sizes ?? []).map((s) => s.size),
      coverage: (row.product_coverages ?? []).map((c) => c.coverage),
      colours
    })
  }

  return catalogue
}
