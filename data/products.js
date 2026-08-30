/**
 * Local product data source.
 *
 * This is the single place the app reads products from. Components import
 * `products` / `categories` / the helpers below — nothing calls an API.
 *
 * ── Swapping to Supabase later ────────────────────────────────────────────
 * Keep this module's public surface identical:
 *   - `categories`                     → static UI list (can stay local)
 *   - `products`                       → array of mapped product objects
 *   - `getProductsByCategory(value)`   → filtered array
 *   - `getProductById(id)`             → one product or undefined
 * Replace the `RAW` array + the exports with Supabase queries (e.g. inside a
 * `useProducts()` composable backed by `@supabase/supabase-js`), mapping each
 * row through `toProduct()` so the shape components receive never changes.
 *
 * ── Product detail fields ─────────────────────────────────────────────────
 * `toProduct()` also exposes optional detail fields, empty until real data
 * is added (the product page hides any section with no data — no invented
 * sizes, colours, prints, materials or copy):
 *   - images         → string[]  (gallery; falls back to [image])
 *   - sizes          → string[]  e.g. ['XS','S','M','L']
 *   - colours        → { name, hex }[]
 *   - prints         → string[]
 *   - details        → string[]  fit / care bullet points
 *   - longDescription→ string    fuller copy (falls back to `description`)
 * Add them to a RAW record to populate that section.
 */

export const categories = [
  { value: 'tops', label: 'Tops', blurb: 'Triangle, balconette & bralette' },
  { value: 'bottoms', label: 'Bottoms', blurb: 'High-waist, tie-side & cheeky' },
  { value: 'one-piece', label: 'One-Piece', blurb: 'Sculpted, plunging & playful' },
  { value: 'cover-ups', label: 'Cover-Ups', blurb: 'Beach to boardwalk' }
]

const CATEGORY_LABELS = Object.fromEntries(categories.map((c) => [c.value, c.label]))
const LOW_STOCK_THRESHOLD = 5

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
})

const img = (seed) => `https://picsum.photos/seed/${seed}/900/1125`

// Raw records — the fields a database row would hold.
// price is in integer cents to avoid floating-point rounding.
const RAW = [
  // ── Tops ──────────────────────────────────────────────
  { id: 'sandbar-triangle', title: 'Sandbar Triangle Top', priceCents: 8800, category: 'tops', stock: 24, image: img('bahama-sandbar'), description: 'Sliding triangle top with hand-finished gold hardware.' },
  { id: 'marina-balconette', title: 'Marina Balconette Top', priceCents: 9800, category: 'tops', stock: 12, image: img('bahama-marina'), description: 'Structured cups and adjustable straps for real support.' },
  { id: 'reef-bralette', title: 'Reef Longline Bralette', priceCents: 9200, category: 'tops', stock: 3, image: img('bahama-reef'), description: 'Ribbed longline bralette with a stay-put banded hem.' },

  // ── Bottoms ───────────────────────────────────────────
  { id: 'palm-highwaist', title: 'Palm High-Waist Brief', priceCents: 8400, category: 'bottoms', stock: 26, image: img('bahama-palm'), description: 'Retro high rise with a smoothing bonded waistband.' },
  { id: 'cove-tie', title: 'Cove Tie-Side Bottom', priceCents: 7800, category: 'bottoms', stock: 18, image: img('bahama-cove'), description: 'Adjustable tie sides with weighted metal tips.' },
  { id: 'dune-highleg', title: 'Dune High-Leg Brief', priceCents: 8000, category: 'bottoms', stock: 0, image: img('bahama-dune'), description: 'High-cut leg and cheeky back for an elongated line.' },

  // ── One-Piece ─────────────────────────────────────────
  { id: 'sol-one-piece', title: 'Sol Scoop-Back One-Piece', priceCents: 14800, category: 'one-piece', stock: 14, image: img('bahama-sol'), description: 'Sculpting scoop back with a clean high leg.' },
  { id: 'harbour-wrap', title: 'Harbour Faux-Wrap One-Piece', priceCents: 15800, category: 'one-piece', stock: 9, image: img('bahama-harbour'), description: 'Plunging faux-wrap front with a supportive shelf bra.' },
  { id: 'lagoon-halter', title: 'Lagoon Halter One-Piece', priceCents: 15200, category: 'one-piece', stock: 4, image: img('bahama-lagoon'), description: 'High-neck halter with an open back and removable cups.' },

  // ── Cover-Ups ─────────────────────────────────────────
  { id: 'islander-swimdress', title: 'Islander Swim Dress', priceCents: 16800, category: 'cover-ups', stock: 10, image: img('bahama-islander'), description: 'Swim-to-street dress in quick-dry crepe with side slits.' },
  { id: 'breeze-kaftan', title: 'Breeze Linen Kaftan', priceCents: 18800, category: 'cover-ups', stock: 7, image: img('bahama-breeze'), description: 'Floor-length washed linen-blend with a hand-rolled hem.' },
  { id: 'shoreline-shirt', title: 'Shoreline Camp Shirt', priceCents: 12800, category: 'cover-ups', stock: 16, image: img('bahama-shoreline'), description: 'Oversized silky camp-collar shirt — beach layer or resort staple.' }
]

/** Map a raw record (or future DB row) to the shape components render. */
export function toProduct(row) {
  const price = row.priceCents / 100
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    longDescription: row.longDescription ?? '',
    price,
    priceFormatted: priceFormatter.format(price),
    category: row.category,
    categoryLabel: CATEGORY_LABELS[row.category] ?? row.category,
    image: row.image,
    images: row.images?.length ? row.images : [row.image],
    sizes: row.sizes ?? [],
    colours: row.colours ?? [],
    prints: row.prints ?? [],
    details: row.details ?? [],
    stock: row.stock,
    inStock: row.stock > 0,
    lowStock: row.stock > 0 && row.stock <= LOW_STOCK_THRESHOLD
  }
}

export const products = RAW.map(toProduct)

export const getProductsByCategory = (value) =>
  value && value !== 'all' ? products.filter((p) => p.category === value) : products

export const getProductById = (id) => products.find((p) => p.id === id)

/** Up to `limit` other products in the same category (for "You may also like"). */
export const getRelatedProducts = (product, limit = 3) =>
  products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, limit)
