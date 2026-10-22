<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { Plus, SearchX, Archive } from 'lucide-vue-next'
import { useBoardStore } from '@/stores/board'
import { useAuthStore } from '@/stores/auth'
import { useTaskEditor } from '@/composables/useTaskEditor'
import { CATS } from '@/utils/widgets'
import KanbanColumn from '@/components/KanbanColumn.vue'
import FilterBar from '@/components/FilterBar.vue'
import TaskModalHost from '@/components/TaskModalHost.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DeleteColumnDialog from '@/components/DeleteColumnDialog.vue'

const props = defineProps({ mine: Boolean }) // true on /my-tasks
const board = useBoardStore()
const auth = useAuthStore()
const editor = reactive(useTaskEditor())

const newColumn = ref('')
const columnToDelete = ref(null)
const columnToArchive = ref(null)
const doneChange = ref(null) // { column, changes } waiting for confirmation
const showArchived = ref(false)

onMounted(() => {
  board.clearFilters()
  if (props.mine) board.filters.assignee = 'me'
  board.start()
})
onUnmounted(() => board.stop())

// Local copy of the visible columns so dragging feels instant; Firestore keeps the real order.
const colList = ref([])
watch(() => board.activeColumns, (v) => (colList.value = [...v]), { immediate: true })
function onColumnDrop(evt) {
  const ids = [...evt.to.children].map((el) => el.dataset.colId).filter(Boolean)
  board.moveColumn(ids)
}

async function addColumn() {
  const n = newColumn.value.trim()
  if (!n) return
  await board.addColumn(n)
  newColumn.value = ''
}
function updateColumn(column, changes) {
  // Switching "counts as completed" does not change tasks that are already in the column, so warn first.
  if ('isDone' in changes && board.taskCount(column.id) > 0) doneChange.value = { column, changes }
  else board.updateColumnSettings(column, changes)
}
async function confirmDone() { await board.updateColumnSettings(doneChange.value.column, doneChange.value.changes); doneChange.value = null }
async function confirmArchive() { await board.archiveColumn(columnToArchive.value, true); columnToArchive.value = null }
async function confirmDelete(targetId) { await board.removeColumn(columnToDelete.value, targetId); columnToDelete.value = null }

const visibleCount = computed(() => board.activeColumns.reduce((n, c) => n + board.tasksIn(c.id).length, 0))
const deleteTargets = computed(() => board.activeColumns.filter((c) => c.id !== columnToDelete.value?.id))
</script>

<template>
  <div class="relative flex h-full flex-col">
    <div class="flex flex-wrap items-center gap-2 px-4 pb-2 pt-4">
      <h1 class="mr-2 text-lg font-extrabold">{{ mine ? 'My tasks' : 'Kanban board' }}</h1>
      <FilterBar :mine="mine" />
      <button v-if="auth.canManage && board.archivedColumns.length" class="btn-ghost ml-auto py-1.5" @click="showArchived = !showArchived"><Archive class="h-4 w-4" />Archived ({{ board.archivedColumns.length }})</button>
    </div>

    <div v-if="showArchived" class="absolute right-4 top-14 z-30 w-72 rounded-xl border border-line bg-surface p-3 shadow-xl">
      <p class="label">Archived columns</p>
      <ul class="space-y-1">
        <li v-for="c in board.archivedColumns" :key="c.id" class="flex items-center justify-between gap-2 text-sm">
          <span class="truncate font-semibold">{{ c.name }} <span class="text-xs text-muted">({{ board.taskCount(c.id) }})</span></span>
          <button class="text-xs font-bold text-accent" @click="board.archiveColumn(c, false)">Restore</button>
        </li>
      </ul>
    </div>

    <div v-if="board.loading" class="flex flex-1 gap-4 overflow-hidden px-4 pt-2">
      <div v-for="n in 4" :key="n" class="w-72 shrink-0 space-y-3"><div class="skeleton h-8" /><div class="skeleton h-28" /><div class="skeleton h-24" /></div>
    </div>

    <div v-else-if="board.error" class="m-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200" role="alert">
      <p class="font-bold">The board could not load.</p><p class="mt-1">{{ board.error }}</p>
      <button class="btn-ghost mt-3" @click="board.start()">Try again</button>
    </div>

    <div v-else-if="!board.columns.length" class="grid flex-1 place-items-center p-6 text-center">
      <div class="max-w-sm">
        <h2 class="text-base font-extrabold">This board has no columns yet</h2>
        <template v-if="auth.canManage">
          <p class="mt-1 text-sm text-muted">Start with the standard set: NEW PROJECT, TODO, DOING, REVIEW and DONE.</p>
          <button class="btn-primary mt-4" @click="board.seedColumns()">Create default columns</button>
        </template>
        <p v-else class="mt-1 text-sm text-muted">Ask a Director or Department Manager to set up the board.</p>
      </div>
    </div>

    <template v-else>
      <p v-if="board.hasFilters && !visibleCount" class="mx-4 mt-2 flex items-center gap-2 text-sm text-muted"><SearchX class="h-4 w-4" />No tasks match these filters.</p>
      <div class="flex min-h-0 flex-1 items-start gap-4 overflow-x-auto px-4 pb-4 pt-9">
        <VueDraggable
          v-model="colList" :disabled="!auth.canManage" handle=".col-handle" :animation="180"
          ghost-class="col-ghost" chosen-class="col-chosen" class="flex max-h-full items-start gap-4" @end="onColumnDrop"
        >
          <KanbanColumn
            v-for="(c, i) in colList" :key="c.id" :data-col-id="c.id" :column="c" :tasks="board.tasksIn(c.id)" :total="board.taskCount(c.id)" :users="board.users"
            :can-manage="auth.canManage" :can-delete="auth.isAdmin" :cat="CATS[i % CATS.length]"
            @open="editor.openTask" @add="editor.openNew(c.id)" @drop="board.dropTask" @rename="(n) => board.rename(c, n)"
            @update="(changes) => updateColumn(c, changes)" @archive="columnToArchive = c" @delete="columnToDelete = c"
          />
        </VueDraggable>
        <form v-if="auth.canManage" class="w-72 shrink-0 rounded-2xl border border-dashed border-line p-3" @submit.prevent="addColumn">
          <label class="label" for="new-col">Add a column</label>
          <div class="flex gap-2">
            <input id="new-col" v-model="newColumn" class="input" placeholder="e.g. BLOCKED" />
            <button class="btn-primary px-2.5" aria-label="Add column"><Plus class="h-4 w-4" /></button>
          </div>
        </form>
      </div>
    </template>

    <TaskModalHost :editor="editor" />
    <DeleteColumnDialog v-if="columnToDelete" :column="columnToDelete" :count="board.taskCount(columnToDelete.id)" :targets="deleteTargets" @cancel="columnToDelete = null" @confirm="confirmDelete" />
    <ConfirmDialog v-if="columnToArchive" title="Archive this column?" :message="`“${columnToArchive.name}” will be hidden from the board. Its tasks stay saved and come back when you restore it.`" confirm-text="Archive" @cancel="columnToArchive = null" @confirm="confirmArchive" />
    <ConfirmDialog v-if="doneChange" title="Change what this column means?" message="Tasks already in this column keep their current completion dates. Only tasks moved in or out from now on are counted as completed or not." confirm-text="Change" @cancel="doneChange = null" @confirm="confirmDone" />
  </div>
</template>
