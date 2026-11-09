/**
 * Pure array-reorder helper for drag-and-drop lists. Moves the item whose
 * `idKey` matches `fromId` to sit where the item matching `toId` currently
 * is. Returns a new array; never mutates `list`. Unknown ids, or
 * fromId === toId, return `list` unchanged (same reference) so callers can
 * cheaply skip a no-op re-render.
 */
export function reorderList(list, fromId, toId, idKey = 'id') {
  if (fromId == null || toId == null || fromId === toId) return list
  const from = list.findIndex((item) => item[idKey] === fromId)
  const to = list.findIndex((item) => item[idKey] === toId)
  if (from === -1 || to === -1) return list
  const next = list.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
