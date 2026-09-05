/**
 * Safe-field mapping for the public storefront product API
 * (server/api/products/index.get.js + [productId].get.js).
 *
 * Reproduces the exact output shape that data/products.js's `toProduct()`
 * used to build, so ProductCard.vue / ProductOptionGroup.vue / the shop
 * pages / useCart.js's addItem() all keep working with zero changes.
 *
 * Never exposed: the products.id UUID, is_active/is_featured, sort_order,
 * timestamps, or anything from other tables. Colours/fabrics are NOT included
 * here — the storefront still fetches those from the unchanged
 * /api/products/:productId/fabrics endpoint.
 */

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// A list row needs its nested images to pick a primary; detail rows need the
// full child sets too.
export const PRODUCT_CARD_SELECT = 'slug, name, category, price_usd_cents, price_xcd_cents, product_images(image_url, sort_order, is_primary)'
export const PRODUCT_DETAIL_SELECT = `
  slug, name, category, description, price_usd_cents, price_xcd_cents,
  product_sizes(size, sort_order),
  product_coverages(coverage, sort_order),
  product_details(detail, sort_order),
  product_images(image_url, sort_order, is_primary),
  product_fabrics(is_available, fabrics(slug, name, hex_color, image_url, type, status, is_active))
`.trim()

const bySort = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)

function primaryImageUrl(row) {
  const imgs = row.product_images ?? []
  if (!imgs.length) return null
  const primary = imgs.find((i) => i.is_primary)
  if (primary) return primary.image_url
  return [...imgs].sort(bySort)[0].image_url
}

const priceFields = (row) => {
  const price = row.price_usd_cents / 100
  const priceXcd = row.price_xcd_cents / 100
  return {
    price,
    priceFormatted: usd.format(price),
    priceXcd,
    priceXcdFormatted: `XCD $${priceXcd.toFixed(2)}`
  }
}

/** Grid/card/related shape — matches toProduct()'s card-relevant fields. */
export function mapProductCard(row) {
  return {
    id: row.slug, // public id stays the slug — unchanged URLs
    title: row.name,
    category: row.category, // canonical string, doubles as the label
    categoryLabel: row.category,
    ...priceFields(row),
    image: primaryImageUrl(row)
  }
}

// Colour options inlined into the detail response (same shape + filter rules
// as GET /api/products/:productId/fabrics — active fabric + available
// relationship; an 'unavailable'-status fabric IS still returned so the
// storefront can show it disabled). Saves the product page a second request.
function coloursFromNested(productFabrics) {
  return (productFabrics ?? [])
    .filter((pf) => pf.is_available === true && pf.fabrics && pf.fabrics.is_active === true)
    .map((pf) => ({
      id: pf.fabrics.slug,
      name: pf.fabrics.name,
      hex: pf.fabrics.hex_color,
      imageUrl: pf.fabrics.image_url,
      type: pf.fabrics.type,
      status: pf.fabrics.status
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Full detail shape — card fields plus everything a product page renders. */
export function mapProductDetail(row) {
  const colours = coloursFromNested(row.product_fabrics)
  return {
    ...mapProductCard(row),
    description: row.description ?? '',
    details: (row.product_details ?? []).slice().sort(bySort).map((d) => d.detail),
    sizes: (row.product_sizes ?? []).slice().sort(bySort).map((s) => s.size),
    coverage: (row.product_coverages ?? []).slice().sort(bySort).map((c) => c.coverage),
    images: (row.product_images ?? []).slice().sort(bySort).map((i) => i.image_url),
    colours
  }
}

// ─────────────────────────── admin shapes ───────────────────────────
// The admin sees the real UUID id, active/featured/sort, and (on detail)
// the image row ids + compatible fabric ids for the edit form.

export const ADMIN_PRODUCT_LIST_SELECT =
  'id, slug, name, category, price_usd_cents, price_xcd_cents, is_active, is_featured, sort_order, product_images(image_url, sort_order, is_primary)'

export const ADMIN_PRODUCT_DETAIL_SELECT = `
  id, slug, name, category, description, price_usd_cents, price_xcd_cents,
  is_active, is_featured, sort_order,
  product_sizes(size, sort_order),
  product_coverages(coverage, sort_order),
  product_details(detail, sort_order),
  product_images(id, image_url, sort_order, is_primary),
  product_fabrics(fabric_id)
`.trim()

export function mapAdminProductListItem(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    priceUsdCents: row.price_usd_cents,
    priceXcdCents: row.price_xcd_cents,
    isActive: row.is_active,
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
    image: primaryImageUrl(row)
  }
}

export function mapAdminProductDetail(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description ?? '',
    priceUsdCents: row.price_usd_cents,
    priceXcdCents: row.price_xcd_cents,
    isActive: row.is_active,
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
    sizes: (row.product_sizes ?? []).slice().sort(bySort).map((s) => s.size),
    coverage: (row.product_coverages ?? []).slice().sort(bySort).map((c) => c.coverage),
    details: (row.product_details ?? []).slice().sort(bySort).map((d) => d.detail),
    images: (row.product_images ?? [])
      .slice()
      .sort(bySort)
      .map((i) => ({ id: i.id, imageUrl: i.image_url, sortOrder: i.sort_order, isPrimary: i.is_primary })),
    fabricIds: (row.product_fabrics ?? []).map((pf) => pf.fabric_id)
  }
}
