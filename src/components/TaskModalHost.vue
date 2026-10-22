<script setup>
import TaskModal from './TaskModal.vue'
import { useBoardStore } from '@/stores/board'
import { useAuthStore } from '@/stores/auth'

defineProps({ editor: Object }) // a reactive(useTaskEditor())
const board = useBoardStore()
const auth = useAuthStore()
</script>

<template>
  <TaskModal
    v-if="editor.modal" :task="editor.modal.task" :columns="board.activeColumns" :users="board.users"
    :default-column-id="editor.modal.columnId" :default-department="auth.profile.departmentId"
    :can-delete="editor.canDeleteTask(editor.modal.task)"
    @close="editor.close()" @create="editor.create" @save="editor.save" @delete="editor.remove"
  />
</template>
