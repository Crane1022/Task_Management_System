<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useRoute, useRouter } from 'vue-router'
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
import BoardSettingsDialog from '@/components/BoardSettingsDialog.vue'
import TaskModalHost from '@/components/TaskModalHost.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DeleteColumnDialog from '@/components/DeleteColumnDialog.vue'
import TaskCardSkeleton from '@/components/TaskCardSkeleton.vue'

const props = defineProps({ mine: Boolean }) // true on /my-tasks
const board = useBoardStore()
const auth = useAuthStore()
const ui = useUiStore()
const wsStore = useWorkspaceStore()
const route = useRoute()
const router = useRouter()
const settingsOpen = ref(false)
const editor = reactive(useTaskEditor())

const newColumn = ref('')
const columnToDelete = ref(null)
const columnToArchive = ref(null)
// A notification links here with ?task=<id>: open that task once the board has loaded it
// (the page is re-created whenever the address changes, so this runs once per click; `handled` stops later task updates reopening it)
let handled = !route.query.task
watch([() => board.tasks, () => board.loading], () => {
  if (handled || board.loading) return
  handled = true
  const t = board.tasks.find((x) => x.id === route.query.task)
  if (t) editor.openTask(t)
  else ui.toast('That task is not on this board any more, or you can no longer open it', 'error')
  window.history.replaceState(window.history.state, '', route.path) // drop ?task= from the address bar without reloading the page
})
// the no-access screen names who can let the person in, when the workspace's admins are known (26 Nov 2026)
const deniedAskWho = computed(() => {
  const w = board.workspace ?? wsStore.workspaceById(board.boardDoc?.workspaceId)
  const admins = Object.entries(w?.members ?? {}).filter(([, r]) => r === 'admin').map(([id]) => board.users[id]?.displayName || board.users[id]?.name).filter(Boolean)
  return admins.length ? admins.slice(0, 2).join(' or ') : 'an admin of its workspace'
})
const doneChange = ref(null) // { column, changes } waiting for confirmation
const showArchived = ref(false)

onMounted(() => {
  // /b/:bid opens that board; the Kanban Board page (/board) always opens on the Main board (switch with the board picker)
  if (route.params.bid) ui.setActiveBoard(route.params.bid)
  else if (route.name === 'board') ui.setActiveBoard('main')
  board.clearFilters()
  if (props.mine) board.filters.assignee = 'me'
  board.start(undefined, { aggregate: true }) // on the Main Board this also shows the tasks of every workspace board the person may open
})
onUnmounted(() => board.stop())

// Local copy of the visible columns so dragging feels instant; Firestore keeps the real order.
const colList = ref([])
watch(() => board.activeColumns, (v) => (colList.value = [...v]), { immediate: true })
// The drag library has already put the new order into colList (v-model). Read THAT: the page itself is only
// redrawn a moment later, so reading the page right after a drop still shows the OLD order and nothing would be saved.
async function onColumnDrop() {
  await nextTick()
  board.moveColumn(colList.value.map((c) => c.id))
}

const addingColumn = ref(false)
async function addColumn() {
  const n = newColumn.value.trim()
  if (!n || addingColumn.value) return
  addingColumn.value = true
  try { await board.addColumn(n); newColumn.value = '' } finally { addingColumn.value = false }
}
const seeding = ref(false)
async function seedColumns() {
  if (seeding.value) return
  seeding.value = true
  try { await board.seedColumns() } finally { seeding.value = false }
}
function updateColumn(column, changes) {
  // Switching "counts as completed" does not change tasks that are already in the column, so warn first.
  if ('isDone' in changes && board.ownTaskCount(column.id) > 0) doneChange.value = { column, changes }
  else board.updateColumnSettings(column, changes)
}
async function confirmDone() { await board.updateColumnSettings(doneChange.value.column, doneChange.value.changes); doneChange.value = null }
async function confirmArchive() { await board.archiveColumn(columnToArchive.value, true); columnToArchive.value = null }
async function confirmDelete(targetId) { await board.removeColumn(columnToDelete.value, targetId); columnToDelete.value = null }

// ----- phone (25 Nov 2026): each column fills the screen. The tabs above jump to a column, swiping works too,
// and a card's Move button opens a list of columns (dragging a card with a thumb is hard).
const boardScroller = ref(null)
const activeCol = ref(0)
const columnEls = () => [...(boardScroller.value?.querySelectorAll('[data-col-id]') ?? [])]
function showColumn(i) {
  const el = columnEls()[i]
  if (el) boardScroller.value.scrollTo({ left: el.offsetLeft - 16, behavior: 'smooth' })
}
function onBoardScroll() {
  if (!ui.isPhone) return
  const els = columnEls()
  const x = boardScroller.value.scrollLeft + 16
  let best = 0
  els.forEach((el, i) => { if (Math.abs(el.offsetLeft - x) < Math.abs(els[best].offsetLeft - x)) best = i })
  activeCol.value = best
}
const moving = ref(null) // the task whose Move sheet is open
async function moveTo(column, i) {
  const t = moving.value
  moving.value = null
  if (!t || t.columnId === column.id) return
  const ids = [...board.tasksIn(column.id).map((x) => x.id).filter((id) => id !== t.id), t.id] // to the bottom of that column
  showColumn(i)
  await board.dropTask({ taskId: t.id, columnId: column.id, ids }) // the card shows "Syncing", then "Saved"
  if (board.tasks.find((x) => x.id === t.id)?.columnId === column.id) ui.toast(`Moved to ${column.name}`)
}

const visibleCount = computed(() => board.activeColumns.reduce((n, c) => n + board.tasksIn(c.id).length, 0))
const deleteTargets = computed(() => board.activeColumns.filter((c) => c.id !== columnToDelete.value?.id))
</script>

<template>
  <div class="relative flex h-full flex-col">
    <div class="flex flex-wrap items-center gap-2 px-4 pb-2 pt-3 sm:pt-4">
      <div class="mr-2 min-w-0">
        <p v-if="board.workspace" class="truncate text-xs font-semibold text-muted"><router-link :to="`/workspaces/${board.workspace.id}`" class="hover:text-accent">{{ board.workspace.name }}</router-link></p>
        <h1 class="flex items-center gap-1.5 text-lg font-extrabold">
          <span class="hidden sm:inline">{{ mine ? 'My tasks' : 'Kanban board' }}</span><span v-if="board.boardName" class="truncate text-sm font-bold text-muted"><span class="hidden sm:inline">· </span>{{ board.boardName }}</span>
          <button v-if="board.boardDoc" class="rounded p-1 text-muted hover:text-highlight" :class="wsStore.isStarred(board.boardId) && 'text-highlight'" :aria-label="wsStore.isStarred(board.boardId) ? 'Unstar this board' : 'Star this board'" :aria-pressed="wsStore.isStarred(board.boardId)" @click="wsStore.toggleStar(board.boardId)"><Star class="h-4 w-4" :fill="wsStore.isStarred(board.boardId) ? 'currentColor' : 'none'" /></button>
          <button v-if="board.boardDoc && board.canManage" class="rounded p-1 text-muted hover:text-accent" aria-label="Board settings" title="Board settings" @click="settingsOpen = true"><Settings2 class="h-4 w-4" /></button>
        </h1>
      </div>
      <BoardPicker />
      <span v-if="board.resolved !== false && !board.loading && !board.canEdit && !board.denied" class="flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-xs font-bold text-muted"><Eye class="h-3.5 w-3.5" />View only</span>
      <span v-if="board.aggregate && !mine" class="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent" title="The same tasks as on each workspace board">All my workspaces</span>
      <div class="scroll-row"><FilterBar :mine="mine" /></div>
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
      <div v-for="(count, c) in [3, 2, 4, 1]" :key="c" class="w-72 shrink-0 rounded-2xl border border-line bg-surface p-3" :style="{ opacity: 1 - c * 0.15 }">
        <div class="mb-3 flex items-center justify-between"><span class="skeleton h-4 w-24 rounded-md" /><span class="skeleton h-4 w-6 rounded-md" /></div>
        <div class="space-y-2"><TaskCardSkeleton v-for="n in count" :key="n" :n="c + n" /></div>
      </div>
    </div>

    <div v-else-if="board.denied" class="grid flex-1 place-items-center p-6 text-center">
      <div class="max-w-sm">
        <ShieldOff class="mx-auto h-8 w-8 text-muted" />
        <h2 class="mt-2 text-base font-extrabold">You don’t have access to this board</h2>
        <p class="mt-1 text-sm text-muted">This board belongs to a workspace you are not a member of. Ask {{ deniedAskWho }} to add you, and it will open straight away.</p>
        <div class="mt-4 flex flex-wrap justify-center gap-2">
          <button class="btn-primary" @click="router.push('/my-tasks')">Go to My tasks</button>
          <button class="btn-ghost" @click="router.push('/board')">Main board</button>
        </div>
        <details class="mt-4 text-left text-xs text-muted"><summary class="cursor-pointer font-bold">Details for IT</summary><p class="mt-1 rounded-lg bg-bg p-2 font-mono">permission-denied · board {{ board.boardId }}</p></details>
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
          <button v-busy="seeding" class="btn-primary mt-4" @click="seedColumns">{{ seeding ? 'Creating…' : 'Create default columns' }}</button>
        </template>
        <p v-else class="mt-1 text-sm text-muted">Ask a Director or Department Manager to set up the board.</p>
      </div>
    </div>

    <template v-else>
      <p v-if="board.hasFilters && !visibleCount" class="mx-4 mt-2 flex items-center gap-2 text-sm text-muted"><SearchX class="h-4 w-4" />No tasks match these filters.</p>
      <div v-if="ui.isPhone && colList.length > 1" class="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-1 pt-1" role="tablist" aria-label="Columns">
        <button v-for="(c, i) in colList" :key="c.id" type="button" role="tab" :aria-selected="activeCol === i"
          class="flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-extrabold tracking-wide"
          :class="activeCol === i ? 'border-accent bg-accent text-on-primary' : 'border-line bg-surface text-muted'" @click="showColumn(i)">
          {{ c.name }}<span class="grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[11px]" :class="activeCol === i ? 'bg-white/25' : 'bg-bg'">{{ board.taskCount(c.id) }}</span>
        </button>
      </div>
      <div ref="boardScroller" class="flex min-h-0 flex-1 snap-x snap-mandatory scroll-px-4 items-start gap-4 overflow-x-auto px-4 pb-4 pt-8 sm:snap-none sm:pt-9" @scroll.passive="onBoardScroll">
        <VueDraggable
          v-model="colList" :disabled="!board.canEdit" handle=".col-handle" :animation="180"
          ghost-class="col-ghost" chosen-class="col-chosen" class="flex max-h-full items-start gap-4" @end="onColumnDrop"
        >
          <KanbanColumn
            v-for="(c, i) in colList" :key="c.id" :data-col-id="c.id" :column="c" :tasks="board.tasksIn(c.id)" :total="board.taskCount(c.id)" :users="board.users" :label-for="board.boardLabelOf"
            :can-manage="board.canManage" :can-delete="board.canDeleteColumn" :can-edit="board.canEdit" :cat="CATS[i % CATS.length]"
            @open="editor.openTask" @add="editor.openNew(c.id)" @drop="board.dropTask" @move="(t) => (moving = t)" @rename="(n) => board.rename(c, n)"
            @update="(changes) => updateColumn(c, changes)" @archive="columnToArchive = c" @delete="columnToDelete = c"
          />
        </VueDraggable>
        <!-- tasks from other boards whose status the Main board has no column for -->
        <KanbanColumn v-if="board.aggregate && board.unplacedTasks.length" virtual :column="{ id: OTHER_COLUMN, name: 'OTHER STATUSES' }" :tasks="board.tasksIn(OTHER_COLUMN)" :total="board.taskCount(OTHER_COLUMN)" :users="board.users" :can-edit="false" :label-for="board.boardLabelOf" @open="editor.openTask" />
        <form v-if="board.canManage" class="w-[calc(100vw-2rem)] shrink-0 snap-start rounded-2xl border border-dashed border-line p-3 sm:w-72" @submit.prevent="addColumn">
          <label class="label" for="new-col">Add a column</label>
          <div class="flex gap-2">
            <input id="new-col" v-model="newColumn" class="input" placeholder="e.g. BLOCKED" />
            <button v-busy="addingColumn" class="btn-primary px-2.5" aria-label="Add column"><Plus class="h-4 w-4" /></button>
          </div>
        </form>
      </div>
    </template>

    <!-- phone: move a card to another column -->
    <template v-if="moving">
      <div class="fixed inset-0 z-50 bg-black/40" @click="moving = null" />
      <div class="sheet fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl" role="dialog" aria-label="Move task">
        <div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
        <p class="text-xs font-bold text-muted">Move to</p>
        <p class="truncate text-base font-extrabold">{{ moving.title }}</p>
        <ul class="mt-3 space-y-1.5">
          <li v-for="(c, i) in colList" :key="c.id">
            <button type="button" class="flex min-h-[48px] w-full items-center justify-between rounded-xl border px-4 text-sm font-extrabold tracking-wide"
              :class="c.id === moving.columnId ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:bg-bg'" :disabled="c.id === moving.columnId" @click="moveTo(c, i)">
              {{ c.name }}<span class="text-xs font-bold text-muted">{{ c.id === moving.columnId ? 'Here now' : board.taskCount(c.id) === 1 ? '1 task' : board.taskCount(c.id) + ' tasks' }}</span>
            </button>
          </li>
        </ul>
        <button type="button" class="btn-ghost mt-3 w-full" @click="moving = null">Cancel</button>
      </div>
    </template>
    <TaskModalHost :editor="editor" />
    <BoardSettingsDialog v-if="settingsOpen && board.boardDoc" :board="board.boardDoc" :workspace="board.workspace" :users="board.users" @close="settingsOpen = false" />
    <DeleteColumnDialog v-if="columnToDelete" :column="columnToDelete" :count="board.ownTaskCount(columnToDelete.id)" :targets="deleteTargets" @cancel="columnToDelete = null" @confirm="confirmDelete" />
    <ConfirmDialog v-if="columnToArchive" title="Archive this column?" :message="`“${columnToArchive.name}” will be hidden from the board. Its tasks stay saved and come back when you restore it.`" confirm-text="Archive" @cancel="columnToArchive = null" @confirm="confirmArchive" />
    <ConfirmDialog v-if="doneChange" title="Change what this column means?" message="Tasks already in this column keep their current completion dates. Only tasks moved in or out from now on are counted as completed or not." confirm-text="Change" @cancel="doneChange = null" @confirm="confirmDone" />
  </div>
</template>
