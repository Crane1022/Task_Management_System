import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import { useAuthStore } from './auth'
import { useUiStore } from './ui'
import { subscribeColumns, createColumn, renameColumn, deleteColumn, seedDefaultColumns, updateColumn, reorderColumns } from '@/services/columnService'
import { subscribeBoardTasks, createTask, updateTask, moveTask, deleteTask, moveAllTasks } from '@/services/taskService'
import { subscribeUsers } from '@/services/userService'
import { startOfToday } from '@/utils/dates'

const STEP = 1000 // gap between positions so a dropped card can take the midpoint

export const useBoardStore = defineStore('board', () => {
  const auth = useAuthStore()
  const ui = useUiStore()

  const columns = ref([])
  const tasks = ref([])
  const users = ref({})
  const loading = ref(true)
  const error = ref('')
  const filters = reactive({ search: '', assignee: '', department: '', priority: '', deadline: '' })
  let unsubs = []
  let loaded = { columns: false, tasks: false }

  function start() {
    stop()
    loading.value = true
    error.value = ''
    loaded = { columns: false, tasks: false }
    const done = (key) => { loaded[key] = true; loading.value = !(loaded.columns && loaded.tasks) }
    const fail = (e) => { error.value = e.message; loading.value = false }

    unsubs = [
      subscribeColumns((c) => { columns.value = c; done('columns') }, fail),
      subscribeBoardTasks(
        { isAdmin: auth.isAdmin, departmentId: auth.profile.departmentId },
        (t) => { tasks.value = t; done('tasks') }, fail,
      ),
      subscribeUsers((u) => (users.value = u), () => {}),
    ]
  }
  function stop() { unsubs.forEach((u) => u()); unsubs = [] }

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

  async function run(fn, errorMessage) {
    try { return await fn() } catch (e) { console.error(e); ui.toast(`${errorMessage}: ${e.code ?? e.message}`, 'error') }
  }

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
    let position
    if (prev && next) position = (prev.position + next.position) / 2
    else if (prev) position = prev.position + STEP
    else if (next) position = next.position - STEP
    else position = STEP
    if (task.columnId === columnId && task.position === position) return
    await moveTask(task, column, position, auth.profile)
  }, 'Could not move task')

  // ----- columns -----
  const addColumn = (name) => run(async () => {
    const last = columns.value.length ? columns.value[columns.value.length - 1].position : 0
    await createColumn(name, last + STEP)
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
    const all = [...columns.value]
    const queue = [...ids]
    const merged = all.map((c) => (c.archived ? c.id : queue.shift()))
    if (merged.every((id, i) => id === all[i].id)) return
    await reorderColumns(merged)
  }, 'Could not reorder columns')

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
  const seedColumns = () => run(seedDefaultColumns, 'Could not create columns')

  return {
    columns, activeColumns, archivedColumns, tasks, filtered, users, loading, error, filters, hasFilters,
    start, stop, clearFilters, tasksIn,
    addTask, saveTask, removeTask, dropTask, addColumn, rename, updateColumnSettings, archiveColumn, moveColumn, taskCount, removeColumn, seedColumns,
  }
})
