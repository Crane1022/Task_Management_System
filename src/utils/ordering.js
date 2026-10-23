// Pure helpers for ordering cards and columns (no Firebase, so they can be unit tested).
export const STEP = 1000 // gap between positions so a dropped card can take the midpoint

// Same order everywhere: by position, then by id so two items with the same position never swap places
export const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.id).localeCompare(String(b.id))

// Position for a card dropped between `prev` and `next` (either may be missing)
export function positionBetween(prev, next) {
  if (prev != null && next != null) return (prev + next) / 2
  if (prev != null) return prev + STEP
  if (next != null) return next - STEP
  return STEP
}

// `visibleIds` = the on-screen order of the non-archived columns after a drag.
// Returns the full list of column IDs (archived ones keep their own slots), or null if nothing changed
// or the lists no longer match (for example someone else just changed the columns).
export function mergeColumnOrder(allColumns, visibleIds) {
  const visibleCount = allColumns.filter((c) => !c.archived).length
  if (visibleIds.length !== visibleCount) return null
  const queue = [...visibleIds]
  const merged = allColumns.map((c) => (c.archived ? c.id : queue.shift()))
  if (new Set(merged).size !== merged.length) return null
  return merged.every((id, i) => id === allColumns[i].id) ? null : merged
}
