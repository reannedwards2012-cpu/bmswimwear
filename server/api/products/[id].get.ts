// Read-only lookup of a single product by id.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''

  if (!/^[a-z0-9-]{1,64}$/i.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid product id' })
  }

  const product = await getProductById(id)
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  }

  return product
})
