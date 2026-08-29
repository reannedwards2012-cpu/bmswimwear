import { CREATE_CATEGORY_INDEX, CREATE_PRODUCTS_TABLE } from '../database/schema'
import { PRODUCT_SEED } from '../database/seed'

// Runs once at server start: creates the products collection if missing and
// seeds it with the mock catalogue when empty. Idempotent — safe on every boot
// and every hot reload.
export default defineNitroPlugin(async () => {
  const db = useDatabase()

  await db.exec(CREATE_PRODUCTS_TABLE)
  await db.exec(CREATE_CATEGORY_INDEX)

  const countResult = await db.sql<{ rows?: { count: number }[] }>`
    SELECT COUNT(*) AS count FROM products
  `
  if (Number(countResult.rows?.[0]?.count ?? 0) > 0) {
    return
  }

  for (const item of PRODUCT_SEED) {
    await db.sql`
      INSERT INTO products (id, title, description, price_cents, category, image_url, stock)
      VALUES (${item.id}, ${item.title}, ${item.description}, ${item.priceCents},
              ${item.category}, ${item.imageUrl}, ${item.stock})
    `
  }

  console.info(`[database] seeded products collection with ${PRODUCT_SEED.length} items`)
})
