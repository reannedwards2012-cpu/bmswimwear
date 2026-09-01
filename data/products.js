/**
 * Local product data source — the real Bahama Mama Swimwear catalogue.
 *
 * This is the single place the app reads products from. Components import
 * `products` / `categories` / the helpers below — nothing calls an API.
 *
 * ── Swapping to Supabase later ────────────────────────────────────────────
 * Keep this module's public surface identical:
 *   - `categories`                     → static UI list
 *   - `products`                       → array of mapped product objects
 *   - `getProductsByCategory(value)`   → filtered array
 *   - `getProductById(id)`             → one product or undefined
 *   - `getRelatedProducts(product,n)`  → same-category picks
 * Replace the `RAW` array with a Supabase query mapped through `toProduct()`
 * so the shape components receive never changes.
 *
 * ── Fabrics / colours ────────────────────────────────────────────────────
 * `FABRIC_COLOURS` is a stand-in for a shared fabric inventory. Products
 * reference colours by id (e.g. 'royal-blue'); `toProduct()` resolves each id
 * to `{ id, name, hex }`. Later this map becomes a Supabase `fabrics` table and
 * a product's `colours` stays a list of fabric ids. Hex values are approximate
 * swatches for now.
 *
 * ── Images ───────────────────────────────────────────────────────────────
 * Photos live in /public/images/products/<id>/01.jpg, 02.jpg, … (optimised;
 * full-res originals are kept git-ignored under _products-original/). 01.jpg is
 * always the lead image; the rest fill the gallery in numerical order.
 */

export const categories = [
  { value: 'tops', label: 'Tops' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'one-pieces', label: 'One Pieces' },
  { value: 'cover-ups', label: 'Cover Ups' }
]

// Every piece is made to order — defined once, not repeated per product.
export const MADE_TO_ORDER = { turnaround: '10–14 business days' }

// Fixed coverage choices for the products that offer them.
export const COVERAGE_OPTIONS = ['Thong', 'Cheeky', 'Bikini']

// Shared fabric registry (future Supabase `fabrics` table).
export const FABRIC_COLOURS = {
  black: { name: 'Black', hex: '#1c1c1c' },
  white: { name: 'White', hex: '#f3efe8' },
  red: { name: 'Red', hex: '#b4292b' },
  'royal-blue': { name: 'Royal Blue', hex: '#26408b' },
  yellow: { name: 'Yellow', hex: '#f2c230' },
  'hot-pink': { name: 'Hot Pink', hex: '#e5449b' },
  'baby-pink': { name: 'Baby Pink', hex: '#f4c2d0' },
  'baby-blue': { name: 'Baby Blue', hex: '#aecbe8' },
  chocolate: { name: 'Chocolate', hex: '#5a3a28' }
}

const CATEGORY_LABELS = Object.fromEntries(categories.map((c) => [c.value, c.label]))

// The full fabric range offered on most made-to-order pieces.
const FULL_RANGE = Object.keys(FABRIC_COLOURS)

const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const KAFTAN_SIZES = ['S/M', 'L/XL']

const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const productImage = (id, n) => `/images/products/${id}/${String(n).padStart(2, '0')}.jpg`

// Raw records — the fields a database row would hold. Prices as integer cents.
const RAW = [
  // ── Tops ──────────────────────────────────────────────
  {
    id: 'kir-royale-top',
    title: 'Kir Royale Top',
    category: 'tops',
    priceUsdCents: 3000,
    priceXcdCents: 8000,
    description: 'A cowl-neck bikini top finished with rhinestones for a little sparkle.',
    details: ['Adjustable fit'],
    sizes: STANDARD_SIZES,
    colours: ['black', 'white', 'red', 'royal-blue'],
    coverage: [],
    imageCount: 4
  },
  {
    id: 'rose-spritz-top',
    title: 'Rose Spritz Top',
    category: 'tops',
    priceUsdCents: 2600,
    priceXcdCents: 7000,
    description: 'A simple halter bikini top with an adjustable tie-back strap.',
    details: ['Adjustable fit'],
    sizes: STANDARD_SIZES,
    colours: FULL_RANGE,
    coverage: [],
    imageCount: 2
  },
  {
    id: 'bm-colada-top',
    title: 'BM Colada Top',
    category: 'tops',
    priceUsdCents: 3000,
    priceXcdCents: 8000,
    description:
      'A minimal-coverage bikini top finished with a gold Bahama Mama logo icon at the base of the neck.',
    details: ['Adjustable fit'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    colours: FULL_RANGE,
    coverage: [],
    imageCount: 2
  },

  // ── Bottoms ───────────────────────────────────────────
  {
    id: 'rose-spritz-bottom',
    title: 'Rose Spritz Bottom',
    category: 'bottoms',
    priceUsdCents: 2600,
    priceXcdCents: 7000,
    description:
      'Thin-strap bikini bottoms with an extra waist strap designed to create a flattering shape.',
    details: ['Thin straps', 'Additional waist strap'],
    sizes: STANDARD_SIZES,
    colours: FULL_RANGE,
    coverage: COVERAGE_OPTIONS,
    imageCount: 2
  },

  // ── One Pieces ────────────────────────────────────────
  {
    id: 'champagne-one-piece',
    title: 'Champagne One Piece',
    category: 'one-pieces',
    priceUsdCents: 6700,
    priceXcdCents: 18000,
    description: 'An edgy cut-out one piece finished with chain detailing at the neckline.',
    details: ['Adjustable fit'],
    sizes: STANDARD_SIZES,
    colours: FULL_RANGE,
    coverage: COVERAGE_OPTIONS,
    imageCount: 3
  },
  {
    id: 'mimosa-one-piece',
    title: 'Mimosa One Piece',
    category: 'one-pieces',
    priceUsdCents: 6600,
    priceXcdCents: 17500,
    description:
      'A minimal bandeau one piece with a high-cut leg, frill detailing and a lace-up back.',
    details: ['Adjustable fit', 'Lace-up back', 'Frills'],
    sizes: STANDARD_SIZES,
    colours: FULL_RANGE,
    coverage: COVERAGE_OPTIONS,
    imageCount: 3
  },
  {
    id: 'diamond-fizz-one-piece',
    title: 'Diamond Fizz One Piece',
    category: 'one-pieces',
    priceUsdCents: 6600,
    priceXcdCents: 17500,
    description:
      'A sexy, minimal-coverage one piece with a criss-cross top, high-cut leg and thong back.',
    details: ['Adjustable fit', 'High-cut leg', 'Thong'],
    sizes: ['XS', 'S', 'M', 'L'],
    colours: FULL_RANGE,
    coverage: [],
    imageCount: 3
  },
  {
    id: 'gimlet-one-piece',
    title: 'Gimlet One Piece',
    category: 'one-pieces',
    priceUsdCents: 6000,
    priceXcdCents: 16000,
    description: 'A clean, one-shoulder one piece with a simple, flattering silhouette.',
    details: ['One shoulder'],
    sizes: STANDARD_SIZES,
    colours: FULL_RANGE,
    coverage: COVERAGE_OPTIONS,
    imageCount: 2
  },
  {
    id: 'french-75-one-piece',
    title: 'French 75 One Piece',
    category: 'one-pieces',
    priceUsdCents: 7000,
    priceXcdCents: 19000,
    description:
      'A clean, minimal one piece with an O-ring belt at the waist, high-cut leg and deep scoop back.',
    details: ['High-cut leg', 'Bikini coverage', 'Deep scoop back', 'O-ring belt'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    colours: FULL_RANGE,
    coverage: [],
    imageCount: 3
  },
  {
    id: 'cosmopolitan-one-piece',
    title: 'Cosmopolitan One Piece',
    category: 'one-pieces',
    priceUsdCents: 6000,
    priceXcdCents: 16000,
    description:
      'A minimal one piece with a deep back and adjustable straps that can be tied in multiple ways.',
    details: ['Adjustable fit', 'Deep back', 'Multiple ways to wear'],
    sizes: STANDARD_SIZES,
    colours: FULL_RANGE,
    coverage: COVERAGE_OPTIONS,
    imageCount: 2
  },
  {
    id: 'mai-tai-one-piece',
    title: 'Mai Tai One Piece',
    category: 'one-pieces',
    priceUsdCents: 6400,
    priceXcdCents: 17000,
    description:
      'A minimal bandeau one piece with a high-cut leg and a statement cut-out that wraps from the sides to the back.',
    details: ['Adjustable fit', 'High-cut leg', 'Bandeau'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    colours: FULL_RANGE,
    coverage: COVERAGE_OPTIONS,
    imageCount: 2
  },
  {
    id: 'margarita-one-piece',
    title: 'Margarita One Piece',
    category: 'one-pieces',
    priceUsdCents: 6000,
    priceXcdCents: 16000,
    description: 'A one-shoulder one piece with a statement cut-out across the waist.',
    details: ['One shoulder', 'Waist cut-out'],
    sizes: STANDARD_SIZES,
    colours: FULL_RANGE,
    coverage: COVERAGE_OPTIONS,
    imageCount: 2
  },

  // ── Cover Ups ─────────────────────────────────────────
  {
    id: 'catch-the-breeze-kaftan',
    title: 'Catch the Breeze Kaftan',
    category: 'cover-ups',
    priceUsdCents: 6700,
    priceXcdCents: 18000,
    description:
      'A long, flowy kaftan with gathered panels along the sleeves and hem, designed for a relaxed fit.',
    details: ['Long length', 'Gathered panels', 'Relaxed fit'],
    sizes: KAFTAN_SIZES,
    colours: [],
    coverage: [],
    imageCount: 2
  },
  {
    id: 'black-sand-cover-up',
    title: 'Black Sand Cover Up',
    category: 'cover-ups',
    priceUsdCents: 5600,
    priceXcdCents: 15000,
    description: 'A mini kaftan with side splits, designed to be tied at the front or worn open.',
    details: ['Mini length', 'Side splits', 'Tie front', 'Can be worn open'],
    sizes: KAFTAN_SIZES,
    colours: [],
    coverage: [],
    imageCount: 2
  }
]

/** Map a raw record (or future DB row) to the shape components render. */
export function toProduct(row) {
  const price = row.priceUsdCents / 100
  const priceXcd = row.priceXcdCents / 100
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    categoryLabel: CATEGORY_LABELS[row.category] ?? row.category,
    description: row.description,
    details: row.details ?? [],
    sizes: row.sizes ?? [],
    colours: (row.colours ?? []).map((id) => ({ id, ...FABRIC_COLOURS[id] })),
    coverage: row.coverage ?? [],
    turnaround: MADE_TO_ORDER.turnaround,
    price,
    priceFormatted: usdFormatter.format(price),
    priceXcd,
    priceXcdFormatted: `XCD $${priceXcd.toFixed(2)}`,
    image: productImage(row.id, 1),
    images: Array.from({ length: row.imageCount }, (_, i) => productImage(row.id, i + 1))
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
