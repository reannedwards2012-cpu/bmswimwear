import { describe, it, expect } from 'vitest'
import { reorderList } from '../utils/reorderList.js'

const LIST = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

describe('reorderList', () => {
  it('moves an item forward to sit where the target item is', () => {
    const next = reorderList(LIST, 'a', 'c')
    expect(next.map((i) => i.id)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves an item backward to sit where the target item is', () => {
    const next = reorderList(LIST, 'd', 'b')
    expect(next.map((i) => i.id)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('never mutates the original list', () => {
    const copy = LIST.map((i) => ({ ...i }))
    reorderList(LIST, 'a', 'c')
    expect(LIST).toEqual(copy)
  })

  it('returns the same array reference when fromId equals toId (no-op)', () => {
    expect(reorderList(LIST, 'b', 'b')).toBe(LIST)
  })

  it('returns the same array reference when either id is unknown', () => {
    expect(reorderList(LIST, 'missing', 'b')).toBe(LIST)
    expect(reorderList(LIST, 'a', 'missing')).toBe(LIST)
  })

  it('returns the same array reference when either id is null/undefined', () => {
    expect(reorderList(LIST, null, 'b')).toBe(LIST)
    expect(reorderList(LIST, 'a', undefined)).toBe(LIST)
  })

  it('supports a custom id key', () => {
    const list = [{ key: 1 }, { key: 2 }, { key: 3 }]
    const next = reorderList(list, 1, 3, 'key')
    expect(next.map((i) => i.key)).toEqual([2, 3, 1])
  })
})
