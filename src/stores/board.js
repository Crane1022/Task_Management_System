import { defineStore } from 'pinia'
import { ref, reactive, computed, watch } from 'vue'
import { useAuthStore } from './auth'
import { useUiStore } from './ui'
import { subscribeColumns, createColumn, renameColumn, deleteColumn, seedDefaultColumns, updateColumn, reorderColumns } from '@/services/columnService'
import { subscribeBoardTasks, createTask, updateTask, moveTask, deleteTask, moveAllTasks } from '@/services/taskService'
import { subscribeUsers } from '@/services/userService'
import { subscribeBoardDoc, subscribeWorkspace } from '@/services/workspaceService'
import { startOfToday } from '@/utils/dates'
import { STEP, positionBetween, mergeColumnOrder } from '@/utils/ordering'
import { effectiveBoardRole, legacyBoardRole, canEdit as roleCanEdit, canManage as roleCanManage } from '@/utils/permissions'
import { BOARD_ID } from '@/utils/constants'

// The board that is open. "main" (no board document) is the original board and keeps its original rules;
// a board WITH a document belongs to a workspace and follows workspace roles (docs/MIGRATION_PLAN.md).
export const useBoardStore = defineStore('board', () => {
  const auth = useAuthStore()
  const ui = useUiStore()

  const boardId = ref(BOARD_ID)
  const boardDoc = ref(null) // null = original board, or not resolved yet
  const resolved = ref(false)
  const workspace = ref(null)
  const denied = ref(false) // Firestore refused access to this board

  const columns = ref([])
  const tasks = ref([])
  const users = ref({})
  const loading = ref(true)
  const error = ref('')
  const filters = reactive({ search: '', assignee: '', department: '', priority: '', deadline: '' })
  let unsubs = []
  let dataUnsubs = []
  let wsUnsub = null
  let wsId = ''
  let dataLegacy = null
  let loaded = { columns: false, tasks: false }
  let running = false

  // ----- who may do what here -----
  const legacy = computed(() => resolved.value && !boardDoc.value)
  const role = computed(() => {
    if (!resolved.value) return 'none'
    if (legacy.value) return legacyBoardRole({ isDirector: auth.isAdmin, canManage: auth.canManage })
    return effectiveBoardRole({
      isDirector: auth.isAdmin,
      workspaceRole: workspace.value?.members?.[auth.user?.uid],
      boardOverride: boardDoc.value?.members?.[auth.user?.uid],
    })
  })
  const canEdit = computed(() => roleCanEdit(role.value))
  const canManage = computed(() => roleCanManage(role.value))
  // original board: only a Director deletes columns (they see every department's tasks); workspace board: a board admin
  const canDeleteColumn = computed(() => (legacy.value ? auth.isAdmin : canManage.value))
  const boardName = computed(() => (boardDoc.value?.name ?? (legacy.value ? 'Main board' : '')))

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
        (t) => { tasks.value = t; done('tasks') }, fail,
      ),
    ]
  }

  function onBoard(b) {
    boardDoc.value = b
    resolved.value = true
    if (b && b.workspaceId !== wsId) { // follow the board's workspace (its members decide the roles)
      wsUnsub?.(); wsId = b.workspaceId; workspace.value = null
      wsUnsub = subscribeWorkspace(wsId, (w) => (workspace.value = w), () => (workspace.value = null))
    } else if (!b && wsUnsub) { wsUnsub(); wsUnsub = null; wsId = ''; workspace.value = null }
    const isLegacy = !b
    if (dataLegacy !== isLegacy) startData(isLegacy)
  }

  function start(id) {
    stop()
    running = true
    boardId.value = id || ui.activeBoardId || BOARD_ID
    resolved.value = false; boardDoc.value = null; workspace.value = null; denied.value = false
    columns.value = []; tasks.value = []
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
    wsUnsub?.(); wsUnsub = null; wsId = ''; dataLegacy = null
  }
  // another board was chosen (board picker, workspace page): reload everything for it
  watch(() => ui.activeBoardId, (id) => { if (running && id !== boardId.value) start(id) })

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
  const tasksIn = (columnId) => tasks.value.filter((t) => t.columnId === columnId && matches(t))

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
  const resetTasks = () => { tasks.value = [...tasks.value] }
  const resetColumns = () => { columns.value = [...columns.value] }

  // ----- tasks -----
  const addTask = (data, columnId) => run(async () => {
    const column = columns.value.find((c) => c.id === columnId)
    await createTask(data, column, endPosition(columnId), auth.profile)
    ui.toast('Task created')
  }, 'Could not create task')

  const saveTask = (task, changes, notes) => run(async () => {
    const column = columns.value.find((c) => c.id === changes.columnId)
    if (column) { // moved from the status dropdown
      await moveTask(task, column, endPosition(column.id), auth.profile)
      delete changes.columnId
    }
    if (Object.keys(changes).length) await updateTask(task.id, changes, notes, auth.profile)
    ui.toast('Task saved')
  }, 'Could not save task')

  const removeTask = (task) => run(async () => { await deleteTask(task.id); ui.toast('Task deleted') }, 'Could not delete task')

  // Called after a drop. `ids` is the final card order of the target column as shown on screen.
  const dropTask = ({ taskId, columnId, ids }) => run(async () => {
    const task = tasks.value.find((t) => t.id === taskId)
    const column = columns.value.find((c) => c.id === columnId)
    if (!task || !column) return
    const i = ids.indexOf(taskId)
    const prev = tasks.value.find((t) => t.id === ids[i - 1])
    const next = tasks.value.find((t) => t.id === ids[i + 1])
    const position = positionBetween(prev?.position, next?.position)
    if (task.columnId === columnId && task.position === position) return
    await moveTask(task, column, position, auth.profile)
  }, 'Could not move task', resetTasks)

  // ----- columns -----
  const addColumn = (name) => run(async () => {
    const last = columns.value.length ? columns.value[columns.value.length - 1].position : 0
    await createColumn(boardId.value, name, last + STEP)
    ui.toast('Column added')
  }, 'Could not add column')
  const rename = (column, name) => run(
    () => renameColumn(column, name, tasks.value.filter((t) => t.columnId === column.id).map((t) => t.id)),
    'Could not rename column')
  const updateColumnSettings = (column, changes) => run(() => updateColumn(column.id, changes), 'Could not update column')
  const archiveColumn = (column, archived) => run(async () => {
    await updateColumn(column.id, { archived })
    ui.toast(archived ? 'Column archived' : 'Column restored')
  }, 'Could not update column')

  // `ids` = visible column IDs in their new on-screen order. Archived columns keep their own slots.
  const moveColumn = (ids) => run(async () => {
    const merged = mergeColumnOrder(columns.value, ids)
    if (merged) await reorderColumns(merged)
  }, 'Could not reorder columns', resetColumns)

  const taskCount = (columnId) => tasks.value.filter((t) => t.columnId === columnId).length
  // Deleting a column never deletes its tasks: they are moved to `targetId` first.
  const removeColumn = (column, targetId) => run(async () => {
    if (taskCount(column.id) > 0) {
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
    boardId, boardDoc, workspace, legacy, resolved, role, canEdit, canManage, canDeleteColumn, boardName, denied,
    columns, activeColumns, archivedColumns, tasks, filtered, users, loading, error, filters, hasFilters,
    start, stop, clearFilters, tasksIn,
    addTask, saveTask, removeTask, dropTask, addColumn, rename, updateColumnSettings, archiveColumn, moveColumn, taskCount, removeColumn, seedColumns,
  }
})
