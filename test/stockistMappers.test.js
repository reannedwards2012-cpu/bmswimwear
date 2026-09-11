import { describe, it, expect } from 'vitest'
import { mapInventoryItem } from '../server/utils/stockistMappers.js'

describe('mapInventoryItem — website product deletion does not destroy boutique history', () => {
  it('a row with product_id = null (its catalogue product has since been deleted) still maps to a fully readable item, from its snapshot fields', () => {
    const row = {
      id: 'item-1',
      stockist_id: 'stk-1',
      source: 'product',
      product_id: null, // ON DELETE SET NULL already fired
      product_name_snapshot: 'Mimosa One Piece',
      product_image_snapshot: '/images/products/mimosa-one-piece/01.jpg',
      reference_code: null,
      colour: 'Black',
      size: 'M',
      coverage: 'Cheeky',
      retail_price_cents: 18000,
      currency: 'XCD',
      default_commission_bps: 1500,
      notes: null,
      remaining_quantity: 2,
      total_supplied_quantity: 3,
      total_sold_quantity: 1,
      total_returned_quantity: 0,
      total_removed_quantity: 0,
      first_sent_at: '2026-08-01',
      is_archived: false,
      created_at: '2026-08-01T00:00:00Z'
    }

    const mapped = mapInventoryItem(row)

    expect(mapped.productId).toBeNull()
    expect(mapped.productName).toBe('Mimosa One Piece')
    expect(mapped.productImage).toBe('/images/products/mimosa-one-piece/01.jpg')
    expect(mapped.colour).toBe('Black')
    expect(mapped.size).toBe('M')
    expect(mapped.coverage).toBe('Cheeky')
    expect(mapped.remainingQuantity).toBe(2)
    expect(mapped.totalSoldQuantity).toBe(1)
  })
})
