<script setup>
import { computed } from 'vue'
import TaskModal from './TaskModal.vue'
import { useBoardStore } from '@/stores/board'
import { useAuthStore } from '@/stores/auth'

// Opens the task panel with what is right for THIS task: the columns and the role of the task's own board
// (on the Main Board a task can belong to any workspace board).
const props = defineProps({ editor: Object }) // a reactive(useTaskEditor())
const board = useBoardStore()
const auth = useAuthStore()

const task = computed(() => props.editor.modal?.task ?? null)
const live = computed(() => (task.value ? board.tasks.find((t) => t.id === task.value.id) ?? task.value : null)) // current copy, for attachments
const taskBoardId = computed(() => task.value?.boardId ?? board.boardId)
const role = computed(() => (task.value ? board.roleOfBoard(taskBoardId.value) : board.role))
const readonly = computed(() => !['admin', 'member'].includes(role.value))
const columns = computed(() => (task.value ? board.columnsFor(taskBoardId.value) : board.activeColumns).filter((c) => !c.archived))
const canDelete = computed(() => !!task.value && (role.value === 'admin' || (role.value === 'member' && task.value.createdBy === auth.user.uid)))
// a new task on the Main Board can go to any workspace board; an existing task can be moved to one
const destinations = computed(() => (board.aggregate || task.value ? board.destinations : []))
</script>

<template>
  <TaskModal
    v-if="editor.modal" :task="task" :live-task="live" :columns="columns" :users="board.users"
    :default-column-id="editor.modal.columnId" :default-department="auth.profile.departmentId"
    :can-delete="canDelete" :can-moderate="role === 'admin'" :readonly="readonly"
    :board-label="task ? board.boardLabelOf(task) : ''" :destinations="destinations" :current-board-id="board.boardId" :load-columns="board.loadColumnsFor"
    @close="editor.close()" @create="editor.create" @save="editor.save" @delete="editor.remove" @move="editor.move"
  />
</template>
