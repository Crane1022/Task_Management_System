// The Main Board shows the tasks of every board the person may open (their own Main columns, plus every workspace board),
// from the SAME task records. Boards have their own columns, so a task from another board sits in the Main column
// with the same name as its status (TODO, DOING, ...).
export const MAIN_BOARD = 'main'
export const statusKey = (s) => String(s ?? '').trim().toUpperCase()
export const columnByStatus = (columns, status) => columns.find((c) => statusKey(c.name) === statusKey(status)) ?? null

export function mainColumnFor(task, mainColumns) {
  if (task.boardId === MAIN_BOARD) return mainColumns.find((c) => c.id === task.columnId) ?? null
  return columnByStatus(mainColumns, task.status)
}

// One list, each task once (the same task can arrive from two listeners)
// If two listeners both deliver it (for example while it is being moved), the more recently updated copy is kept.
const stamp = (t) => t.updatedAt?.seconds ?? Number.MAX_SAFE_INTEGER // a write the server has not confirmed yet is the newest
export function mergeTasks(...lists) {
  const seen = new Map()
  for (const list of lists) for (const t of list) { const old = seen.get(t.id); if (!old || stamp(t) > stamp(old)) seen.set(t.id, t) }
  return [...seen.values()]
}

// Tasks that fit no Main column (their board has a status Main does not have)
export const unplaced = (tasks, mainColumns) => tasks.filter((t) => !mainColumnFor(t, mainColumns))

// Where a task from another board goes when it is dropped into a Main column: the column of ITS OWN board with that name
export const ownColumnFor = (targetMainColumn, boardColumns) => columnByStatus(boardColumns, targetMainColumn.name)

// A task's workspace: stored on the task, or worked out from its board for tasks made before this existed
export const workspaceOfTask = (task, boardById) => task.workspaceId ?? boardById(task.boardId)?.workspaceId ?? null

// "Where should this task go?" Only boards the person may add tasks to (admin or member), grouped by workspace.
// roleOf(workspace, board) -> 'admin' | 'member' | 'viewer' | 'none'
export function destinations({ workspaces, boardsByWs, roleOf, includeMain = true }) {
  // once the Main board has been put inside a workspace it is listed with that workspace instead
  const mainInWorkspace = Object.values(boardsByWs).some((list) => list.some((b) => b.id === MAIN_BOARD))
  const out = includeMain && !mainInWorkspace ? [{ value: MAIN_BOARD, boardId: MAIN_BOARD, workspaceId: null, label: 'Main board (no workspace)', group: 'Main board' }] : []
  for (const w of workspaces) {
    if (w.archived) continue
    for (const b of boardsByWs[w.id] ?? []) {
      if (b.archived || !['admin', 'member'].includes(roleOf(w, b))) continue
      out.push({ value: b.id, boardId: b.id, workspaceId: w.id, label: `${w.name} › ${b.name}`, group: w.name, workspaceName: w.name, boardName: b.name })
    }
  }
  return out
}
