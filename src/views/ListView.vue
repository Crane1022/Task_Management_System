<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { Plus, Check, Minus, X } from 'lucide-vue-next'
import { useBoardStore } from '@/stores/board'
import { useTaskEditor } from '@/composables/useTaskEditor'
import { priorityOf, deptName, displayOf } from '@/utils/constants'
import { formatDate, dueState } from '@/utils/dates'
import FilterBar from '@/components/FilterBar.vue'
import BoardPicker from '@/components/BoardPicker.vue'
import TaskModalHost from '@/components/TaskModalHost.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import BulkBar from '@/components/BulkBar.vue'
import ViewSwitch from '@/components/ViewSwitch.vue'

const board = useBoardStore()
const editor = reactive(useTaskEditor())
const sort = ref('due')

const route = useRoute()
// A dashboard card opens this page with ?show=... so the list holds exactly the tasks that were counted
const SHOW = {
  total: {}, completed: { state: 'done' }, pending: { state: 'open' },
  overdue: { state: 'open', deadline: 'overdue' }, dueToday: { state: 'open', deadline: 'today' },
}
const shown = computed(() => ({ total: 'All tasks', completed: 'Completed tasks', pending: 'Pending tasks', overdue: 'Overdue tasks', dueToday: 'Tasks due today' })[route.query.show] ?? '')
onMounted(() => {
  board.clearFilters()
  // Same tasks as the Dashboard (the chosen board's own tasks), so a number on the Dashboard matches the list it opens
  board.start()
  const q = route.query
  Object.assign(board.filters, SHOW[q.show] ?? {})
  if (q.assignee) board.filters.assignee = String(q.assignee)
  if (q.department) board.filters.department = String(q.department)
  if (q.days) board.filters.createdDays = String(q.days)
})
onUnmounted(() => board.stop())

const ORDER = { urgent: 0, high: 1, medium: 2, low: 3 }
const rows = computed(() => {
  const l = [...board.filtered]
  if (sort.value === 'due') l.sort((a, b) => (a.dueDate?.toMillis?.() ?? 9e15) - (b.dueDate?.toMillis?.() ?? 9e15))
  else if (sort.value === 'priority') l.sort((a, b) => ORDER[a.priority] - ORDER[b.priority])
  else l.sort((a, b) => (b.createdAt?.toMillis?.() ?? 9e15) - (a.createdAt?.toMillis?.() ?? 9e15))
  return l
})
// ----- tick tasks to change many at once (26 Nov 2026) -----
// desktop: the box at the start of each row; phone: press and hold a task (or "Select"), then tap the others
const selected = ref([])
const selecting = ref(false) // phone: tapping a card selects it instead of opening it
const isSel = (t) => selected.value.includes(t.id)
const selectedTasks = computed(() => rows.value.filter(isSel))
const allOn = computed(() => rows.value.length > 0 && selectedTasks.value.length === rows.value.length)
function toggle(t) { selected.value = isSel(t) ? selected.value.filter((id) => id !== t.id) : [...selected.value, t.id] }
function toggleAll() { selected.value = allOn.value ? [] : rows.value.map((t) => t.id) }
function clearSel() { selected.value = []; selecting.value = false }
// a selected task that disappears (deleted, filtered out) leaves the selection
watch(rows, (l) => { const ids = new Set(l.map((t) => t.id)); selected.value = selected.value.filter((id) => ids.has(id)) })
let holdTimer = null
function holdStart(t) { holdTimer = setTimeout(() => { selecting.value = true; if (!isSel(t)) toggle(t); navigator.vibrate?.(15); holdTimer = 'held' }, 450) }
function holdEnd() { if (holdTimer !== 'held') clearTimeout(holdTimer) }
function tapCard(t) {
  if (holdTimer === 'held') { holdTimer = null; return } // the press that started selecting
  if (selecting.value) { toggle(t); if (!selected.value.length) selecting.value = false } else editor.openTask(t)
}

const peopleOf = (t) => (t.assignedTo ?? []).map((id) => board.users[id]).filter(Boolean)
const names = (t) => (t.assignedTo ?? []).map((id) => displayOf(board.users[id])).filter(Boolean).join(', ') || '—'
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- phone: List | Calendar, or the selection bar while tasks are ticked -->
    <div class="px-4 pt-3 sm:hidden">
      <div v-if="selecting" class="flex h-11 items-center gap-2 rounded-xl bg-ink px-1 text-bg">
        <button type="button" class="grid h-11 w-11 place-items-center" aria-label="Stop selecting" @click="clearSel"><X class="h-5 w-5" /></button>
        <span class="flex-1 text-[15px] font-extrabold">{{ selected.length }} selected</span>
        <button type="button" class="h-11 px-3 text-sm font-extrabold text-highlight" @click="toggleAll">{{ allOn ? 'Select none' : 'Select all' }}</button>
      </div>
      <ViewSwitch v-else />
    </div>
    <div class="flex flex-wrap items-center gap-2 px-4 pb-2 pt-3 sm:pt-4">
      <h1 class="mr-2 text-lg font-extrabold"><span class="hidden sm:inline">List</span><span v-if="board.boardName" class="text-sm font-bold text-muted"><span class="hidden sm:inline"> · </span>{{ board.boardName }}</span><span v-if="shown" class="text-sm font-bold text-accent"> · {{ shown }} ({{ rows.length }})</span></h1>
      <BoardPicker />
      <div class="scroll-row">
        <FilterBar />
        <select v-model="sort" class="input w-44" aria-label="Sort tasks">
          <option value="due">Sort: deadline</option><option value="priority">Sort: priority</option><option value="new">Sort: newest</option>
        </select>
      </div>
      <button v-if="rows.length && !selecting" type="button" class="ml-auto text-sm font-extrabold text-accent sm:hidden" @click="selecting = true">Select</button>
    </div>

    <div v-if="board.loading" class="space-y-1.5 px-4 pt-2" aria-label="Loading tasks" role="status">
      <div v-for="n in 6" :key="n" class="flex h-12 items-center gap-3 rounded-xl border border-line bg-surface px-3" :style="{ opacity: 1 - n * 0.1 }">
        <span class="skeleton h-3.5 rounded-md" :style="{ width: ['38%', '30%', '44%', '26%', '35%', '40%'][n - 1] }" />
        <span class="skeleton ml-auto h-4 w-14 rounded-md" /><span class="skeleton h-4 w-20 rounded-md" /><span class="skeleton h-6 w-6 rounded-full" />
      </div>
    </div>
    <div v-else-if="board.error" class="m-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200" role="alert">
      <p class="font-bold">The list could not load.</p><p class="mt-1">{{ board.error }}</p><button class="btn-ghost mt-3" @click="board.start()">Try again</button>
    </div>
    <div v-else-if="!rows.length" class="grid flex-1 place-items-center p-6 text-center">
      <div>
        <p class="text-base font-extrabold">{{ board.hasFilters ? 'No tasks match these filters' : 'No tasks yet' }}</p>
        <button v-if="!board.hasFilters" class="btn-primary mt-4" @click="editor.openNew(board.columns[0]?.id)"><Plus class="h-4 w-4" />Create the first task</button>
      </div>
    </div>
    <div v-else class="min-h-0 flex-1 overflow-auto px-4 pb-4">
      <!-- phone (25 Nov 2026): one card per task instead of a wide table -->
      <ul class="space-y-2 sm:hidden">
        <li v-for="(t, i) in rows" :key="t.id" class="stagger-in" :style="{ '--i': i }">
          <button type="button" class="w-full select-none rounded-2xl border px-3.5 py-3 text-left active:border-highlight" :class="isSel(t) ? 'border-highlight bg-accent-soft' : 'border-line bg-surface'" :aria-pressed="selecting ? isSel(t) : null"
            @click="tapCard(t)" @touchstart.passive="holdStart(t)" @touchend="holdEnd" @touchmove.passive="holdEnd" @contextmenu.prevent>
            <span class="flex items-start gap-2.5">
              <span v-if="selecting" class="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2" :class="isSel(t) ? 'border-accent bg-accent text-on-primary' : 'border-line'"><Check v-if="isSel(t)" class="tick-pop h-3.5 w-3.5" /></span>
              <span class="min-w-0 flex-1 text-[15px] font-extrabold leading-snug">{{ t.title }}</span>
              <span class="flex shrink-0 -space-x-1.5"><UserAvatar v-for="u in peopleOf(t).slice(0, 2)" :key="u.id" :user="u" :size="26" class="rounded-full border-2 border-surface" /></span>
            </span>
            <span class="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-bold">
              <span class="rounded-full bg-accent-soft px-2 py-0.5 text-accent">{{ board.columnNameOf(t) }}</span>
              <span class="rounded-md px-1.5 py-0.5" :class="priorityOf(t.priority).cls">{{ priorityOf(t.priority).name }}</span>
              <span class="rounded-md bg-bg px-1.5 py-0.5 text-muted">{{ deptName(t.departmentId) }}</span>
              <span class="ml-auto" :class="dueState(t) === 'overdue' ? 'text-red-600' : 'text-muted'">{{ formatDate(t.dueDate) || 'No deadline' }}</span>
            </span>
          </button>
        </li>
      </ul>
      <table class="hidden w-full min-w-[560px] lg:min-w-[760px] sm:table border-separate border-spacing-y-1.5 text-left text-sm">
        <thead class="text-xs font-bold text-muted">
          <tr><th class="w-11 py-1 pl-1"><button type="button" class="grid h-9 w-9 place-items-center" :aria-label="allOn ? 'Select no tasks' : 'Select all tasks'" :aria-pressed="allOn" @click="toggleAll"><span class="grid h-5 w-5 place-items-center rounded-md border-2" :class="selected.length ? 'border-accent bg-accent text-on-primary' : 'border-line bg-surface'"><Check v-if="allOn" class="tick-pop h-3 w-3" /><Minus v-else-if="selected.length" class="tick-pop h-3 w-3" /></span></button></th><th class="px-3 py-1">Task</th><th class="px-3 py-1">Status</th><th class="hidden px-3 py-1 lg:table-cell">Assigned to</th><th class="px-3 py-1">Priority</th><th class="hidden px-3 py-1 lg:table-cell">Department</th><th class="px-3 py-1">Deadline</th></tr>
        </thead>
        <tbody>
          <tr v-for="(t, i) in rows" :key="t.id" tabindex="0" class="stagger-in group cursor-pointer" :class="isSel(t) && 'is-selected'" :style="{ '--i': i }" @click="editor.openTask(t)" @keydown.enter="editor.openTask(t)">
            <td class="rounded-l-xl border-y border-l border-line bg-surface py-1 pl-1 group-hover:border-highlight" @click.stop><button type="button" class="grid h-9 w-9 place-items-center" :aria-label="`Select ${t.title}`" :aria-pressed="isSel(t)" @click="toggle(t)"><span class="grid h-5 w-5 place-items-center rounded-md border-2" :class="isSel(t) ? 'border-accent bg-accent text-on-primary' : 'border-line bg-surface'"><Check v-if="isSel(t)" class="tick-pop h-3 w-3" /></span></button></td>
            <td class="border-y border-line bg-surface px-3 py-2.5 font-bold group-hover:border-highlight group-focus-visible:border-accent">{{ t.title }}</td>
            <td class="border-y border-line bg-surface px-3 py-2.5 group-hover:border-highlight">{{ board.columnNameOf(t) }}</td>
            <td class="hidden border-y border-line bg-surface px-3 py-2.5 group-hover:border-highlight lg:table-cell">{{ names(t) }}</td>
            <td class="border-y border-line bg-surface px-3 py-2.5 group-hover:border-highlight"><span class="rounded-md px-1.5 py-0.5 text-xs font-semibold" :class="priorityOf(t.priority).cls">{{ priorityOf(t.priority).name }}</span></td>
            <td class="hidden border-y border-line bg-surface px-3 py-2.5 group-hover:border-highlight lg:table-cell">{{ deptName(t.departmentId) }}</td>
            <td class="rounded-r-xl border-y border-r border-line bg-surface px-3 py-2.5 group-hover:border-highlight" :class="{ 'font-bold text-red-600': dueState(t) === 'overdue' }">{{ formatDate(t.dueDate) || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <Transition name="select-bar"><BulkBar v-if="selected.length" :tasks="selectedTasks" @clear="clearSel" @done="clearSel" /></Transition>
    <TaskModalHost :editor="editor" />
  </div>
</template>

<style scoped>
/* a ticked row is tinted */
tr.is-selected > td { background-color: var(--accent-soft); border-color: var(--highlight); }
</style>
