import {
  CATEGORY_LABELS,
  PRODUCT_CATEGORIES,
  type ProductCategory,
  type ProductRow
} from '../database/schema'

// Shape returned to the client. `price` is dollars + a preformatted string so
// the frontend never does money math; raw column names are not leaked.
export interface ProductDTO {
  id: string
  title: string
  description: string
  price: number
  priceFormatted: string
  category: ProductCategory
  categoryLabel: string
  image: string
  stock: number
  inStock: boolean
  lowStock: boolean
}

const LOW_STOCK_THRESHOLD = 5

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
})

function toDTO(row: ProductRow): ProductDTO {
  const price = row.price_cents / 100
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price,
    priceFormatted: priceFormatter.format(price),
    category: row.category,
    categoryLabel: CATEGORY_LABELS[row.category] ?? row.category,
    image: row.image_url,
    stock: row.stock,
    inStock: row.stock > 0,
    lowStock: row.stock > 0 && row.stock <= LOW_STOCK_THRESHOLD
  }
}

export function parseCategory(value: unknown): ProductCategory | undefined {
  return typeof value === 'string' && (PRODUCT_CATEGORIES as readonly string[]).includes(value)
    ? (value as ProductCategory)
    : undefined
}

export async function listProducts(
  filter: { category?: ProductCategory } = {}
): Promise<ProductDTO[]> {
  const db = useDatabase()
  const result = filter.category
    ? await db.sql<{ rows?: ProductRow[] }>`
        SELECT * FROM products WHERE category = ${filter.category}
        ORDER BY price_cents DESC, title ASC
      `
    : await db.sql<{ rows?: ProductRow[] }>`
        SELECT * FROM products
        ORDER BY category ASC, price_cents DESC, title ASC
      `
  return (result.rows ?? []).map(toDTO)
}

export async function getProductById(id: string): Promise<ProductDTO | null> {
  const db = useDatabase()
  const { rows } = await db.sql<{ rows?: ProductRow[] }>`
    SELECT * FROM products WHERE id = ${id} LIMIT 1
  `
  const row = rows?.[0]
  return row ? toDTO(row) : null
}
