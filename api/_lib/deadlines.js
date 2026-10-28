// Which deadline reminders are due. Pure (no database), so it can be tested.
// "Today" starts at midnight in the office's time zone (REMINDER_UTC_OFFSET_HOURS, default 8 = Malaysia), because a due date
// is saved as midnight of that day. A task is
//   overdue   when its due date is before today                        -> one notice per task, ever
//   due soon  when its due date is today or tomorrow                   -> one notice per task, ever
// and only while it is not completed. The notice goes to everyone assigned to the task.
export const DAY = 86400000

export function startOfDay(now, offsetHours = 8) {
  const off = offsetHours * 3600000
  return new Date(Math.floor((now.getTime() + off) / DAY) * DAY - off)
}

// tasks: [{ id, title, boardId, workspaceId, dueDate: Date, completedAt, assignedTo: [] }]
// -> [{ uid, id, data }] where `id` is a fixed document id, so running again never makes a second copy
export function planReminders(tasks, now = new Date(), offsetHours = 8) {
  const today = startOfDay(now, offsetHours).getTime()
  const out = []
  for (const t of tasks) {
    if (!t.dueDate || t.completedAt || !t.assignedTo?.length) continue
    const due = t.dueDate.getTime()
    const kind = due < today ? 'deadline_overdue' : due < today + 2 * DAY ? 'deadline_soon' : ''
    if (!kind) continue
    const title = kind === 'deadline_overdue' ? 'A task of yours is overdue' : due < today + DAY ? 'A task of yours is due today' : 'A task of yours is due tomorrow'
    for (const uid of new Set(t.assignedTo)) {
      out.push({
        uid, id: `${kind}_${t.id}`,
        data: { type: kind, title, body: String(t.title ?? '').slice(0, 200), taskId: t.id, boardId: t.boardId ?? '', workspaceId: t.workspaceId ?? '', byId: '', byName: 'Widebed TMS', read: false },
      })
    }
  }
  return out
}
