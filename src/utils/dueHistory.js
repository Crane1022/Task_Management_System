// Due date history (18 Nov 2026): every change of a task's due date is kept on the task itself, in `dueHistory`,
// so the PMS (TMS performance) can show when a task was due and who moved the date. Unlike the activity log (only the
// newest 15 lines), this list keeps the changes until it holds DUE_HISTORY_LIMIT of them.
//   dueHistory: [{ from: Timestamp|null, to: Timestamp|null, by: uid, byName, at: Timestamp }]
// firestore.rules (dueHistoryOk) accepts a write only when the list grows by exactly one entry, made by the person
// saving, together with a change of dueDate, and the earlier entries stay as they were.
export const DUE_HISTORY_LIMIT = 50

const millis = (v) => {
  if (!v) return null
  if (typeof v.toMillis === 'function') return v.toMillis()
  const d = v instanceof Date ? v : new Date(v)
  return isNaN(d) ? null : d.getTime()
}
// Same due date? (null and missing count as "no due date")
export const sameDue = (a, b) => millis(a) === millis(b)

// The list after changing the due date from `from` to `to`, or null when nothing should be added (same date, or full).
// `now` is a Firestore Timestamp (Timestamp.now()); serverTimestamp() can't be used inside a list.
export function withDueChange(list, from, to, user, now) {
  const old = Array.isArray(list) ? list : []
  if (sameDue(from, to) || old.length >= DUE_HISTORY_LIMIT) return null
  return [...old, { from: from ?? null, to: to ?? null, by: user.id, byName: String(user.displayName || user.name || user.email || 'Someone').slice(0, 80), at: now }]
}
