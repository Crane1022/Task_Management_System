// Calendar page helpers (26 Nov 2026). Weeks start on Monday. Dates are local days written as "YYYY-MM-DD".
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const parseDay = (k) => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7))

// the days shown for a month: whole weeks from the Monday before the 1st to the Sunday after the last day
export function monthGrid(year, month) {
  const first = new Date(year, month, 1)
  const start = mondayOf(first)
  const last = new Date(year, month + 1, 0)
  const count = Math.round((addDays(mondayOf(last), 7) - start) / 86400000)
  return Array.from({ length: count }, (_, i) => { const d = addDays(start, i); return { date: d, key: dayKey(d), inMonth: d.getMonth() === month } })
}
export const weekDays = (d) => { const m = mondayOf(d); return Array.from({ length: 7 }, (_, i) => { const x = addDays(m, i); return { date: x, key: dayKey(x), inMonth: true } }) }

// tasks grouped by the day of their deadline: { 'YYYY-MM-DD': [task…] }
export function byDueDay(tasks) {
  const out = {}
  for (const t of tasks) {
    const d = t.dueDate?.toDate?.()
    if (!d) continue
    ;(out[dayKey(d)] ||= []).push(t)
  }
  return out
}
