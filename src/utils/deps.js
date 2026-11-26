// Task dependencies (26 Nov 2026). A task keeps `blockedBy`: the IDs of the tasks that must be finished first.
// "Waiting on" = its blockedBy; "Holding up" = the tasks whose blockedBy contains it. A task counts as finished when it
// has completedAt (it is in a column marked "counts as completed").
export const MAX_BLOCKERS = 20

const isDone = (t) => !!t?.completedAt

// -> [{ id, task|null, done }]; task is null when the person cannot see it (another board, or deleted)
export function blockersOf(task, all) {
  const byId = new Map(all.map((t) => [t.id, t]))
  return (task?.blockedBy ?? []).map((id) => { const t = byId.get(id) ?? null; return { id, task: t, done: isDone(t) } })
}
// the ones still open. A task we cannot see counts as open only if it still exists for someone: we cannot tell, so it is
// left out (a deleted task must never block anything forever)
export const openBlockers = (task, all) => blockersOf(task, all).filter((b) => b.task && !b.done)
export const holdingUp = (task, all) => all.filter((t) => t.id !== task?.id && (t.blockedBy ?? []).includes(task?.id))
export const canFinish = (task, all) => openBlockers(task, all).length === 0

// true when adding `blockerId` to `task` would make a loop (A waits on B, B waits on A …)
export function makesLoop(taskId, blockerId, all) {
  if (taskId === blockerId) return true
  const byId = new Map(all.map((t) => [t.id, t]))
  const seen = new Set()
  const stack = [blockerId]
  while (stack.length) {
    const id = stack.pop()
    if (id === taskId) return true
    if (seen.has(id)) continue
    seen.add(id)
    stack.push(...(byId.get(id)?.blockedBy ?? []))
  }
  return false
}

// a short sentence for a toast when a task cannot be finished yet
export function waitingMessage(task, all) {
  const open = openBlockers(task, all)
  if (!open.length) return ''
  const names = open.slice(0, 2).map((b) => `“${b.task.title}”`).join(' and ')
  const more = open.length > 2 ? ` and ${open.length - 2} more` : ''
  return `“${task.title}” is waiting on ${names}${more}. Finish ${open.length === 1 ? 'that task' : 'those tasks'} first`
}
