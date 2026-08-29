// Read-only listing of the product collection.
// Optional ?category= filter, validated against the allowed set.
export default defineEventHandler(async (event) => {
  const { category: categoryParam } = getQuery(event)

  const category = parseCategory(categoryParam)
  if (categoryParam !== undefined && !category) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown category' })
  }

  const items = await listProducts({ category })
  return { count: items.length, items }
})
