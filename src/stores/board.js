import { defineStore } from 'pinia'
import { ref, reactive, computed, watch } from 'vue'
import { useAuthStore } from './auth'
import { useUiStore } from './ui'
import { useCompanionStore } from './companion'
import { useWorkspaceStore } from './workspace'
import { useNotificationStore } from './notifications'
import { subscribeColumns, fetchColumns, createColumn, renameColumn, deleteColumn, seedDefaultColumns, updateColumn, reorderColumns } from '@/services/columnService'
import { subscribeBoardTasks, createTask, updateTask, moveTask, moveTaskToBoard, deleteTask, moveAllTasks } from '@/services/taskService'
import { subscribeUsers } from '@/services/userService'
import { subscribeBoardDoc, subscribeWorkspace } from '@/services/workspaceService'
import { startOfToday } from '@/utils/dates'
import { STEP, byPosition, positionBetween, mergeColumnOrder } from '@/utils/ordering'
import { effectiveBoardRole, legacyBoardRole, canEdit as roleCanEdit, canManage as roleCanManage } from '@/utils/permissions'
import { MAIN_BOARD, mergeTasks, mainColumnFor, unplaced, ownColumnFor, columnByStatus, destinations as buildDestinations } from '@/utils/aggregate'
import { BOARD_ID } from '@/utils/constants'

export const OTHER_COLUMN = '__other' // the extra column on the Main Board for tasks whose status Main does not have

// The board that is open. "main" (no board document) is the original board and keeps its original rules;
// a board WITH a document belongs to a workspace and follows workspace roles (docs/MIGRATION_PLAN.md).
//
// The MAIN BOARD page can also show the tasks of every other board the person may open ("aggregate"). Those are the same
// task records as on the workspace boards (each task exists once), shown in the Main column with the same name as its status.
export const useBoardStore = defineStore('board', () => {
  const auth = useAuthStore()
  const ui = useUiStore()
  const companion = useCompanionStore()
  const wsStore = useWorkspaceStore()
  const notif = useNotificationStore()

  const boardId = ref(BOARD_ID)
  const boardDoc = ref(null) // null = original board, or not resolved yet
  const resolved = ref(false)
  const workspace = ref(null)
  const workspaceDenied = ref(false) // the workspace of this board cannot be read (for example Super Private)
  const denied = ref(false) // Firestore refused access to this board

  const columns = ref([])
  const ownTasks = ref([]) // the tasks of THIS board
  const extraTasks = ref({}) // boardId -> tasks of the other boards (Main Board only)
  const extraColumns = ref({}) // boardId -> columns of those boards
  const fetchedColumns = ref({}) // boardId -> columns read once (move destinations)
  const users = ref({})
  const loading = ref(true)
  const error = ref('')
  const filters = reactive({ search: '', assignee: '', department: '', priority: '', deadline: '', state: '', createdDays: '' })
  let unsubs = []
  let dataUnsubs = []
  const extraStops = new Map()
  let wsUnsub = null
  let wsId = ''
  let dataLegacy = null
  let loaded = { columns: false, tasks: false }
  let running = false
  let lastOptions = {}

  const aggregateWanted = ref(false)
  const aggregate = computed(() => aggregateWanted.value && boardId.value === MAIN_BOARD)
  const tasks = computed(() => (aggregate.value ? mergeTasks(ownTasks.value, ...Object.values(extraTasks.value)) : ownTasks.value))

  // ----- who may do what here -----
  const legacy = computed(() => resolved.value && !boardDoc.value)
  const role = computed(() => {
    if (!resolved.value) return 'none'
    if (legacy.value) return legacyBoardRole({ isDirector: auth.isAdmin, canManage: auth.canManage })
    if (workspaceDenied.value) return 'none' // a workspace this person cannot read (Super Private): no access
    return effectiveBoardRole({
      isDirector: auth.isAdmin,
      workspaceRole: workspace.value?.members?.[auth.user?.uid],
      workspacePrivate: !!workspace.value?.superPrivate,
      boardOverride: boardDoc.value?.members?.[auth.user?.uid],
    })
  })
  const canEdit = computed(() => roleCanEdit(role.value))
  const canManage = computed(() => roleCanManage(role.value))
  // original board: only a Director deletes columns (they see every department's tasks); workspace board: a board admin
  const canDeleteColumn = computed(() => (legacy.value ? auth.isAdmin : canManage.value))
  const boardName = computed(() => (boardDoc.value?.name ?? (legacy.value ? 'Main board' : '')))

  // the role on any board by ID (this one, or another board of a workspace)
  function roleOfBoard(id) {
    if (id === boardId.value) return role.value
    const b = wsStore.boardById(id)
    return b ? wsStore.roleOnBoard(wsStore.workspaceById(b.workspaceId), b) : legacyBoardRole({ isDirector: auth.isAdmin, canManage: auth.canManage })
  }

  // ----- loading -----
  const fail = (e) => {
    denied.value = e.code === 'permission-denied'
    error.value = e.message
    loading.value = false
  }

  function startData(isLegacy) {
    dataUnsubs.forEach((u) => u()); dataUnsubs = []
    dataLegacy = isLegacy
    loaded = { columns: false, tasks: false }
    loading.value = true
    error.value = ''; denied.value = false
    const done = (key) => { loaded[key] = true; loading.value = !(loaded.columns && loaded.tasks) }
    dataUnsubs = [
      subscribeColumns(boardId.value, (c) => { columns.value = c; done('columns') }, fail),
      subscribeBoardTasks(
        { boardId: boardId.value, legacy: isLegacy, isAdmin: auth.isAdmin, departmentId: auth.profile.departmentId, uid: auth.user.uid },
        (t) => { ownTasks.value = t; done('tasks') }, fail,
      ),
    ]
  }

  function onBoard(b) {
    boardDoc.value = b
    resolved.value = true
    if (b && b.workspaceId !== wsId) { // follow the board's workspace (its members decide the roles)
      wsUnsub?.(); wsId = b.workspaceId; workspace.value = null; workspaceDenied.value = false
      wsUnsub = subscribeWorkspace(wsId, (w) => { workspace.value = w; workspaceDenied.value = !w }, () => { workspace.value = null; workspaceDenied.value = true })
    } else if (!b && wsUnsub) { wsUnsub(); wsUnsub = null; wsId = ''; workspace.value = null; workspaceDenied.value = false }
    const isLegacy = !b
    if (dataLegacy !== isLegacy) startData(isLegacy)
  }

  // ----- the other boards, for the Main Board page -----
  // every board the person may open (workspace not archived, board not archived, some role on it), except this one
  const accessibleBoards = computed(() => {
    const out = []
    for (const w of wsStore.workspaces) {
      if (w.archived) continue
      for (const b of wsStore.boards[w.id] ?? []) {
        if (b.archived || b.id === boardId.value) continue
        if (wsStore.roleOnBoard(w, b) !== 'none') out.push({ board: b, workspace: w })
      }
    }
    return out
  })
  function dropExtra(id) {
    extraStops.get(id)?.forEach((s) => s()); extraStops.delete(id)
    const t = { ...extraTasks.value }; delete t[id]; extraTasks.value = t
    const c = { ...extraColumns.value }; delete c[id]; extraColumns.value = c
  }
  function syncExtras() {
    const want = new Set(aggregate.value && resolved.value ? accessibleBoards.value.map((x) => x.board.id) : [])
    for (const id of [...extraStops.keys()]) if (!want.has(id)) dropExtra(id)
    for (const id of want) {
      if (extraStops.has(id)) continue
      extraStops.set(id, [
        // one listener per board, so the server can check each board's access separately; a board that cannot be read is left out
        subscribeBoardTasks({ boardId: id, legacy: false }, (t) => { extraTasks.value = { ...extraTasks.value, [id]: t } }, () => dropExtra(id)),
        subscribeColumns(id, (c) => { extraColumns.value = { ...extraColumns.value, [id]: c } }, () => {}),
      ])
    }
  }
  watch([aggregate, accessibleBoards, resolved], syncExtras)

  function start(id, options = {}) {
    stop()
    running = true
    lastOptions = options
    boardId.value = id || ui.activeBoardId || BOARD_ID
    aggregateWanted.value = !!options.aggregate
    resolved.value = false; boardDoc.value = null; workspace.value = null; workspaceDenied.value = false; denied.value = false
    columns.value = []; ownTasks.value = []; extraTasks.value = {}; extraColumns.value = {}
    loading.value = true; error.value = ''
    unsubs = [
      subscribeUsers((u) => (users.value = u), () => {}),
      subscribeBoardDoc(boardId.value, onBoard, fail),
    ]
  }
  function stop() {
    running = false
    unsubs.forEach((u) => u()); unsubs = []
    dataUnsubs.forEach((u) => u()); dataUnsubs = []
    for (const id of [...extraStops.keys()]) dropExtra(id)
    wsUnsub?.(); wsUnsub = null; wsId = ''; dataLegacy = null
  }
  // another board was chosen (board picker, workspace page): reload everything for it
  watch(() => ui.activeBoardId, (id) => { if (running && id !== boardId.value) start(id, lastOptions) })

  // ----- filtering -----
  const hasFilters = computed(() => Object.values(filters).some(Boolean))
  const clearFilters = () => Object.keys(filters).forEach((k) => (filters[k] = ''))

  function matches(t) {
    const f = filters
    if (f.search) {
      const s = f.search.toLowerCase()
      if (!`${t.title} ${t.description ?? ''}`.toLowerCase().includes(s)) return false
    }
    if (f.assignee) {
      const id = f.assignee === 'me' ? auth.user.uid : f.assignee
      if (!t.assignedTo?.includes(id)) return false
    }
    if (f.department && t.departmentId !== f.department) return false
    if (f.state === 'done' && !t.completedAt) return false // the dashboard cards: Completed / Pending
    if (f.state === 'open' && t.completedAt) return false
    if (f.createdDays && (t.createdAt?.toMillis?.() ?? Date.now()) < Date.now() - Number(f.createdDays) * 86400000) return false
    if (f.priority && t.priority !== f.priority) return false
    if (f.deadline) {
      const due = t.dueDate?.toDate?.()
      const today = startOfToday()
      const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7)
      if (f.deadline === 'none') return !due
      if (!due) return false
      if (f.deadline === 'overdue') return due < today && !t.completedAt
      if (f.deadline === 'today') return due.getTime() === today.getTime()
      if (f.deadline === 'week') return due >= today && due <= weekEnd
    }
    return true
  }
  const activeColumns = computed(() => columns.value.filter((c) => !c.archived))
  const archivedColumns = computed(() => columns.value.filter((c) => c.archived))
  const filtered = computed(() => tasks.value.filter(matches))

  // On the Main Board page a task from another board sits in the Main column named like its status
  const columnOf = (t) => (aggregate.value ? mainColumnFor(t, activeColumns.value)?.id ?? null : t.columnId)
  const unplacedTasks = computed(() => (aggregate.value ? unplaced(tasks.value, activeColumns.value).filter(matches) : []))
  const tasksIn = (columnId) => {
    if (!aggregate.value) return tasks.value.filter((t) => t.columnId === columnId && matches(t))
    if (columnId === OTHER_COLUMN) return unplacedTasks.value
    return tasks.value.filter((t) => columnOf(t) === columnId && matches(t)).sort(byPosition)
  }
  const taskCount = (columnId) => {
    if (!aggregate.value) return tasks.value.filter((t) => t.columnId === columnId).length
    if (columnId === OTHER_COLUMN) return unplaced(tasks.value, activeColumns.value).length
    return tasks.value.filter((t) => columnOf(t) === columnId).length
  }
  const ownTaskCount = (columnId) => ownTasks.value.filter((t) => t.columnId === columnId).length // for deleting a column

  // the columns of any board we know about (this one, another one listed on the Main Board, or one read for a move)
  const columnsFor = (id) => (id === boardId.value ? columns.value : extraColumns.value[id] ?? fetchedColumns.value[id] ?? [])
  async function loadColumnsFor(id) {
    if (columnsFor(id).length) return columnsFor(id)
    const cols = await fetchColumns(id)
    fetchedColumns.value = { ...fetchedColumns.value, [id]: cols }
    return cols
  }
  const columnNameOf = (t) => columnsFor(t.boardId).find((c) => c.id === t.columnId)?.name ?? t.status ?? ''
  // a small "IT Workspace › Support" tag for tasks that belong to another board than the one being shown
  function boardLabelOf(t) {
    if (!aggregate.value || t.boardId === boardId.value) return ''
    const b = wsStore.boardById(t.boardId)
    const w = b && wsStore.workspaceById(b.workspaceId)
    return b ? `${w?.name ?? ''} › ${b.name}` : ''
  }

  // where a task can be created or moved to: only boards the person may add tasks to
  const destinations = computed(() => buildDestinations({
    workspaces: wsStore.workspaces, boardsByWs: wsStore.boards, roleOf: (w, b) => wsStore.roleOnBoard(w, b), includeMain: !wsStore.boardById(MAIN_BOARD),
  }))

  // ----- positions -----
  const endPosition = (columnId) => {
    const list = tasks.value.filter((t) => t.columnId === columnId)
    return list.length ? Math.max(...list.map((t) => t.position)) + STEP : STEP
  }

  // `onFail` puts the screen back to what is saved, e.g. a card that was dragged but refused by the server
  async function run(fn, errorMessage, onFail) {
    try { return await fn() } catch (e) {
      console.error(e)
      ui.toast(`${errorMessage}: ${e.code ?? e.message}`, 'error')
      onFail?.()
    }
  }
  const resetTasks = () => { ownTasks.value = [...ownTasks.value]; extraTasks.value = { ...extraTasks.value } }
  const resetColumns = () => { columns.value = [...columns.value] }

  // ----- tasks -----
  // `destBoardId`: on the Main Board a task can be created in any workspace board the person may add to; on a workspace
  // board it is always this board (and this workspace).
  const addTask = (data, columnId, destBoardId = boardId.value) => run(async () => {
    if (!['admin', 'member'].includes(roleOfBoard(destBoardId))) { ui.toast('You cannot add tasks to that board', 'error'); return }
    const column = columnsFor(destBoardId).find((c) => c.id === columnId)
    if (!column) { ui.toast('Choose a column for the task', 'error'); return }
    const workspaceId = destBoardId === boardId.value ? boardDoc.value?.workspaceId ?? null : wsStore.boardById(destBoardId)?.workspaceId ?? null
    const id = await createTask(data, column, endPosition(columnId), auth.profile, workspaceId)
    notif.taskAssigned({ id, title: data.title, boardId: destBoardId, workspaceId }, data.assignedTo ?? [])
    ui.toast('Task created')
    companion.react('created')
  }, 'Could not create task')

  const saveTask = (task, changes, notes) => run(async () => {
    const column = columnsFor(task.boardId).find((c) => c.id === changes.columnId)
    if (column) { // moved from the status dropdown (a column of the task's own board)
      await moveTask(task, column, endPosition(column.id), auth.profile)
      if (task.columnId !== column.id) notif.taskMoved(task, column.name, column.isDone)
      if (column.isDone && task.columnId !== column.id) companion.react('completed')
      delete changes.columnId
    }
    if (Object.keys(changes).length) await updateTask(task.id, changes, notes, auth.profile)
    if (changes.assignedTo) notif.taskAssigned(task, changes.assignedTo.filter((id) => !(task.assignedTo ?? []).includes(id)))
    ui.toast('Task saved')
  }, 'Could not save task')

  // Moves the task (same record, same ID) to a column of another workspace board
  const moveToBoard = (task, destValue, columnId) => run(async () => {
    const dest = destinations.value.find((d) => d.value === destValue)
    if (!dest) { ui.toast('You cannot move tasks to that board', 'error'); return false }
    const cols = await loadColumnsFor(dest.boardId)
    const column = cols.find((c) => c.id === columnId) ?? columnByStatus(cols, task.status) ?? cols.find((c) => !c.archived)
    if (!column) { ui.toast('That board has no columns yet', 'error'); return false }
    const known = tasks.value.some((t) => t.columnId === column.id)
    await moveTaskToBoard(task, dest, column, known ? endPosition(column.id) : Date.now(), auth.profile)
    notif.taskMoved(task, `${dest.label} › ${column.name}`, column.isDone)
    if (column.isDone) companion.react('completed')
    ui.toast(`Moved to ${dest.label}`)
    return true
  }, 'Could not move the task')

  const removeTask = (task) => run(async () => { await deleteTask(task.id); ui.toast('Task deleted') }, 'Could not delete task')

  // Called after a drop. `ids` is the final card order of the target column as shown on screen.
  const dropTask = ({ taskId, columnId, ids }) => run(async () => {
    const task = tasks.value.find((t) => t.id === taskId)
    const target = columns.value.find((c) => c.id === columnId) // a column of THIS board
    if (!task || !target) { resetTasks(); return } // e.g. dropped into the "other statuses" column
    let column = target
    if (aggregate.value && task.boardId !== boardId.value) {
      // a task of another board moves to the column of ITS OWN board that has the same name
      if (!['admin', 'member'].includes(roleOfBoard(task.boardId))) { ui.toast('You can only view tasks on that board', 'error'); resetTasks(); return }
      column = ownColumnFor(target, columnsFor(task.boardId))
      if (!column) {
        ui.toast(`“${boardLabelOf(task)}” has no column called “${target.name}”. Move the task on its own board.`, 'error'); resetTasks(); return
      }
    }
    const i = ids.indexOf(taskId)
    const prev = tasks.value.find((t) => t.id === ids[i - 1])
    const next = tasks.value.find((t) => t.id === ids[i + 1])
    const position = positionBetween(prev?.position, next?.position)
    if (task.columnId === column.id && task.position === position) return
    await moveTask(task, column, position, auth.profile)
    if (task.columnId !== column.id) notif.taskMoved(task, column.name, column.isDone)
    if (column.isDone && task.columnId !== column.id) companion.react('completed') // a card dropped into a completed column
  }, 'Could not move task', resetTasks)

  // ----- columns -----
  const addColumn = (name) => run(async () => {
    const last = columns.value.length ? columns.value[columns.value.length - 1].position : 0
    await createColumn(boardId.value, name, last + STEP)
    ui.toast('Column added')
  }, 'Could not add column')
  const rename = (column, name) => run(
    () => renameColumn(column, name, ownTasks.value.filter((t) => t.columnId === column.id).map((t) => t.id)),
    'Could not rename column')
  const updateColumnSettings = (column, changes) => run(() => updateColumn(column.id, changes), 'Could not update column')
  const archiveColumn = (column, archived) => run(async () => {
    await updateColumn(column.id, { archived })
    ui.toast(archived ? 'Column archived' : 'Column restored')
  }, 'Could not update column')

  // `ids` = visible column IDs in their new on-screen order. Archived columns keep their own slots.
  const moveColumn = (ids) => run(async () => {
    const merged = mergeColumnOrder(columns.value, ids.filter((id) => id !== OTHER_COLUMN))
    if (merged) await reorderColumns(merged)
  }, 'Could not reorder columns', resetColumns)

  // Deleting a column never deletes its tasks: they are moved to `targetId` first. (Only this board's own tasks are in it.)
  const removeColumn = (column, targetId) => run(async () => {
    if (ownTaskCount(column.id) > 0) {
      const target = columns.value.find((c) => c.id === targetId)
      if (!target) { ui.toast('Choose where to move the tasks first', 'error'); return }
      const moved = await moveAllTasks(column, target, auth.profile)
      ui.toast(`${moved} task${moved === 1 ? '' : 's'} moved to ${target.name}`)
    }
    await deleteColumn(column.id)
    ui.toast('Column deleted')
  }, 'Could not delete column')
  const seedColumns = () => run(() => seedDefaultColumns(boardId.value), 'Could not create columns')

  return {
    boardId, boardDoc, workspace, legacy, resolved, role, canEdit, canManage, canDeleteColumn, boardName, denied, aggregate,
    columns, activeColumns, archivedColumns, tasks, ownTasks, filtered, users, loading, error, filters, hasFilters,
    unplacedTasks, destinations,
    start, stop, clearFilters, tasksIn, columnsFor, loadColumnsFor, columnNameOf, boardLabelOf, roleOfBoard,
    addTask, saveTask, moveToBoard, removeTask, dropTask, addColumn, rename, updateColumnSettings, archiveColumn, moveColumn,
    taskCount, ownTaskCount, removeColumn, seedColumns,
  }
})
