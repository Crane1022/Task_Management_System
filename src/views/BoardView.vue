<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useRoute } from 'vue-router'
import { Plus, SearchX, Archive, Star, Settings2, Eye, ShieldOff } from 'lucide-vue-next'
import { useBoardStore, OTHER_COLUMN } from '@/stores/board'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'
import { useTaskEditor } from '@/composables/useTaskEditor'
import { CATS } from '@/utils/widgets'
import KanbanColumn from '@/components/KanbanColumn.vue'
import FilterBar from '@/components/FilterBar.vue'
import BoardPicker from '@/components/BoardPicker.vue'
import TaskToolbar from '@/components/TaskToolbar.vue'
import BoardSettingsDialog from '@/components/BoardSettingsDialog.vue'
import TaskModalHost from '@/components/TaskModalHost.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DeleteColumnDialog from '@/components/DeleteColumnDialog.vue'

const props = defineProps({ mine: Boolean }) // true on /my-tasks
const board = useBoardStore()
const auth = useAuthStore()
const ui = useUiStore()
const wsStore = useWorkspaceStore()
const route = useRoute()
const settingsOpen = ref(false)
const editor = reactive(useTaskEditor())

const newColumn = ref('')
const columnToDelete = ref(null)
const columnToArchive = ref(null)
const doneChange = ref(null) // { column, changes } waiting for confirmation
const showArchived = ref(false)

onMounted(() => {
  if (route.params.bid) ui.setActiveBoard(route.params.bid) // /b/:bid opens that board
  board.clearFilters()
  if (props.mine) board.filters.assignee = 'me'
  board.start(undefined, { aggregate: true }) // on the Main Board this also shows the tasks of every workspace board the person may open
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
  if ('isDone' in changes && board.ownTaskCount(column.id) > 0) doneChange.value = { column, changes }
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
      <div class="mr-2 min-w-0">
        <p v-if="board.workspace" class="truncate text-xs font-semibold text-muted"><router-link :to="`/workspaces/${board.workspace.id}`" class="hover:text-accent">{{ board.workspace.name }}</router-link></p>
        <h1 class="flex items-center gap-1.5 text-lg font-extrabold">
          {{ mine ? 'My tasks' : 'Kanban board' }}<span v-if="board.boardName" class="truncate text-sm font-bold text-muted">· {{ board.boardName }}</span>
          <button v-if="board.boardDoc" class="rounded p-1 text-muted hover:text-highlight" :class="wsStore.isStarred(board.boardId) && 'text-highlight'" :aria-label="wsStore.isStarred(board.boardId) ? 'Unstar this board' : 'Star this board'" :aria-pressed="wsStore.isStarred(board.boardId)" @click="wsStore.toggleStar(board.boardId)"><Star class="h-4 w-4" :fill="wsStore.isStarred(board.boardId) ? 'currentColor' : 'none'" /></button>
          <button v-if="board.boardDoc && board.canManage" class="rounded p-1 text-muted hover:text-accent" aria-label="Board settings" title="Board settings" @click="settingsOpen = true"><Settings2 class="h-4 w-4" /></button>
        </h1>
      </div>
      <BoardPicker />
      <span v-if="board.resolved !== false && !board.loading && !board.canEdit && !board.denied" class="flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-xs font-bold text-muted"><Eye class="h-3.5 w-3.5" />View only</span>
      <span v-if="board.aggregate && !mine" class="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent" title="The same tasks as on each workspace board">All my workspaces</span>
      <FilterBar :mine="mine" />
      <TaskToolbar />
      <button v-if="board.canManage && board.archivedColumns.length" class="btn-ghost py-1.5" @click="showArchived = !showArchived"><Archive class="h-4 w-4" />Archived ({{ board.archivedColumns.length }})</button>
    </div>

    <div v-if="showArchived" class="absolute right-4 top-14 z-30 w-72 rounded-xl border border-line bg-surface p-3 shadow-xl">
      <p class="label">Archived columns</p>
      <ul class="space-y-1">
        <li v-for="c in board.archivedColumns" :key="c.id" class="flex items-center justify-between gap-2 text-sm">
          <span class="truncate font-semibold">{{ c.name }} <span class="text-xs text-muted">({{ board.ownTaskCount(c.id) }})</span></span>
          <button class="text-xs font-bold text-accent" @click="board.archiveColumn(c, false)">Restore</button>
        </li>
      </ul>
    </div>

    <div v-if="board.loading" class="flex flex-1 gap-4 overflow-hidden px-4 pt-2">
      <div v-for="n in 4" :key="n" class="w-72 shrink-0 space-y-3"><div class="skeleton h-8" /><div class="skeleton h-28" /><div class="skeleton h-24" /></div>
    </div>

    <div v-else-if="board.denied" class="grid flex-1 place-items-center p-6 text-center">
      <div class="max-w-sm">
        <ShieldOff class="mx-auto h-8 w-8 text-muted" />
        <h2 class="mt-2 text-base font-extrabold">You do not have access to this board</h2>
        <p class="mt-1 text-sm text-muted">Ask an admin of its workspace to add you as a member.</p>
        <button class="btn-primary mt-4" @click="ui.setActiveBoard('main')">Go to the Main board</button>
      </div>
    </div>

    <div v-else-if="board.error" class="m-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200" role="alert">
      <p class="font-bold">The board could not load.</p><p class="mt-1">{{ board.error }}</p>
      <button class="btn-ghost mt-3" @click="board.start()">Try again</button>
    </div>

    <div v-else-if="!board.columns.length" class="grid flex-1 place-items-center p-6 text-center">
      <div class="max-w-sm">
        <h2 class="text-base font-extrabold">This board has no columns yet</h2>
        <template v-if="board.canManage">
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
          v-model="colList" :disabled="!board.canManage" handle=".col-handle" :animation="180"
          ghost-class="col-ghost" chosen-class="col-chosen" class="flex max-h-full items-start gap-4" @end="onColumnDrop"
        >
          <KanbanColumn
            v-for="(c, i) in colList" :key="c.id" :data-col-id="c.id" :column="c" :tasks="board.tasksIn(c.id)" :total="board.taskCount(c.id)" :users="board.users" :label-for="board.boardLabelOf"
            :can-manage="board.canManage" :can-delete="board.canDeleteColumn" :can-edit="board.canEdit" :cat="CATS[i % CATS.length]"
            @open="editor.openTask" @add="editor.openNew(c.id)" @drop="board.dropTask" @rename="(n) => board.rename(c, n)"
            @update="(changes) => updateColumn(c, changes)" @archive="columnToArchive = c" @delete="columnToDelete = c"
          />
        </VueDraggable>
        <!-- tasks from other boards whose status the Main board has no column for -->
        <KanbanColumn v-if="board.aggregate && board.unplacedTasks.length" virtual :column="{ id: OTHER_COLUMN, name: 'OTHER STATUSES' }" :tasks="board.tasksIn(OTHER_COLUMN)" :total="board.taskCount(OTHER_COLUMN)" :users="board.users" :can-edit="false" :label-for="board.boardLabelOf" @open="editor.openTask" />
        <form v-if="board.canManage" class="w-72 shrink-0 rounded-2xl border border-dashed border-line p-3" @submit.prevent="addColumn">
          <label class="label" for="new-col">Add a column</label>
          <div class="flex gap-2">
            <input id="new-col" v-model="newColumn" class="input" placeholder="e.g. BLOCKED" />
            <button class="btn-primary px-2.5" aria-label="Add column"><Plus class="h-4 w-4" /></button>
          </div>
        </form>
      </div>
    </template>

    <TaskModalHost :editor="editor" />
    <BoardSettingsDialog v-if="settingsOpen && board.boardDoc" :board="board.boardDoc" :workspace="board.workspace" :users="board.users" @close="settingsOpen = false" />
    <DeleteColumnDialog v-if="columnToDelete" :column="columnToDelete" :count="board.ownTaskCount(columnToDelete.id)" :targets="deleteTargets" @cancel="columnToDelete = null" @confirm="confirmDelete" />
    <ConfirmDialog v-if="columnToArchive" title="Archive this column?" :message="`“${columnToArchive.name}” will be hidden from the board. Its tasks stay saved and come back when you restore it.`" confirm-text="Archive" @cancel="columnToArchive = null" @confirm="confirmArchive" />
    <ConfirmDialog v-if="doneChange" title="Change what this column means?" message="Tasks already in this column keep their current completion dates. Only tasks moved in or out from now on are counted as completed or not." confirm-text="Change" @cancel="doneChange = null" @confirm="confirmDone" />
  </div>
</template>
