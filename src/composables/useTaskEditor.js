import { ref, watch } from 'vue'
import { useBoardStore } from '@/stores/board'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

// Shared by the Kanban and List views: opening, creating, saving and deleting a task.
export function useTaskEditor() {
  const board = useBoardStore()
  const auth = useAuthStore()
  const ui = useUiStore()
  const modal = ref(null) // { task, columnId }

  const openNew = (columnId) => {
    if (!board.canEdit) { ui.toast('You have view-only access to this board', 'error'); return }
    if (!board.columns.length) { ui.toast('Create the board columns first', 'error'); return }
    modal.value = { task: null, columnId }
  }
  const openTask = (task) => (modal.value = { task, columnId: task.columnId })
  const close = () => (modal.value = null)

  // the "New task" button in the top bar
  watch(() => ui.newTaskTick, () => openNew(board.columns[0]?.id))

  async function create(data, columnId, destBoardId) { await board.addTask(data, columnId, destBoardId); close() }
  async function save(changes, notes) { await board.saveTask(modal.value.task, changes, notes); close() }
  async function remove() { await board.removeTask(modal.value.task); close() }
  async function move(destValue, columnId) { if (await board.moveToBoard(modal.value.task, destValue, columnId)) close() }
  const canDeleteTask = (task) => board.canManage || (board.canEdit && task?.createdBy === auth.user.uid)

  return { modal, openNew, openTask, close, create, save, remove, move, canDeleteTask }
}
