// Product collection schema for the internal SQLite database.
// Price is stored as integer cents to avoid floating-point rounding.

export const PRODUCT_CATEGORIES = ['tops', 'bottoms', 'one-piece', 'cover-ups'] as const
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  tops: 'Tops',
  bottoms: 'Bottoms',
  'one-piece': 'One-Piece',
  'cover-ups': 'Cover-Ups'
}

// Mirrors the DB columns exactly.
export interface ProductRow {
  id: string
  title: string
  description: string
  price_cents: number
  category: ProductCategory
  image_url: string
  stock: number
  created_at: string
  updated_at: string
}

// CHECK constraints keep the collection well-formed even if a future writer
// bypasses the application layer.
export const CREATE_PRODUCTS_TABLE = /* sql */ `
  CREATE TABLE IF NOT EXISTS products (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL CHECK (length(trim(title)) > 0),
    description TEXT NOT NULL CHECK (length(trim(description)) > 0),
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    category    TEXT NOT NULL CHECK (category IN ('tops', 'bottoms', 'one-piece', 'cover-ups')),
    image_url   TEXT NOT NULL CHECK (image_url LIKE 'http%' OR image_url LIKE '/%'),
    stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`

export const CREATE_CATEGORY_INDEX = /* sql */ `
  CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
`
