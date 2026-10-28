// Numbers for the board preview cards, from a board's columns and tasks (pure).
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

export function summarizeBoard(columns = [], tasks = [], now = new Date()) {
  const today = startOfDay(now)
  let done = 0
  let overdue = 0
  const perColumn = new Map()
  for (const t of tasks) {
    perColumn.set(t.columnId, (perColumn.get(t.columnId) ?? 0) + 1)
    if (t.completedAt) { done++; continue }
    const due = t.dueDate?.toDate?.()
    if (due && due < today) overdue++
  }
  return {
    total: tasks.length,
    done,
    overdue,
    columns: columns.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name, color: c.color ?? '', count: perColumn.get(c.id) ?? 0 })),
  }
}

// "just now", "5 min ago", "3 days ago", or a date for older things
export function timeAgo(date, now = new Date()) {
  if (!date) return 'just now'
  const s = Math.max(0, Math.round((now - date) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 86400 * 30) { const d = Math.floor(s / 86400); return `${d} day${d === 1 ? '' : 's'} ago` }
  return date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}
