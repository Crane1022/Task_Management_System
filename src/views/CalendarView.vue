<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-vue-next'
import { useBoardStore } from '@/stores/board'
import { useTaskEditor } from '@/composables/useTaskEditor'
import { priorityOf, displayOf } from '@/utils/constants'
import { MONTHS, WEEKDAYS, dayKey, parseDay, addDays, monthGrid, weekDays, byDueDay } from '@/utils/calendar'
import BoardPicker from '@/components/BoardPicker.vue'
import FilterBar from '@/components/FilterBar.vue'
import TaskModalHost from '@/components/TaskModalHost.vue'
import ViewSwitch from '@/components/ViewSwitch.vue'

// Calendar (26 Nov 2026): the tasks of the chosen board by deadline, a month or a week at a time.
// Drag a task to another day to move its deadline; click a day to see its tasks on the right (below on a phone).
const board = useBoardStore()
const editor = reactive(useTaskEditor())
onMounted(() => { board.clearFilters(); board.start() })
onUnmounted(() => board.stop())

const today = dayKey(new Date())
const selected = ref(today)
const view = ref(localStorage.getItem('wb-calendar-view') === 'week' ? 'week' : 'month')
const cursor = ref(new Date()) // any day inside the month (or week) on screen
const dir = ref('next') // which way the next month slides in
// the week shown is the one with the chosen day in it
function setView(v) { view.value = v; localStorage.setItem('wb-calendar-view', v); if (v === 'week') cursor.value = parseDay(selected.value) }

const days = computed(() => (view.value === 'week' ? weekDays(cursor.value) : monthGrid(cursor.value.getFullYear(), cursor.value.getMonth())))
const tasksByDay = computed(() => byDueDay(board.filtered))
const title = computed(() => {
  if (view.value === 'month') return `${MONTHS[cursor.value.getMonth()]} ${cursor.value.getFullYear()}`
  const w = days.value
  const a = w[0].date, b = w[6].date
  return `${a.getDate()} ${MONTHS[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${MONTHS[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`
})
const pageKey = computed(() => `${view.value}-${days.value[0].key}`)

function step(n) {
  dir.value = n > 0 ? 'next' : 'prev'
  const c = cursor.value
  cursor.value = view.value === 'week' ? addDays(c, 7 * n) : new Date(c.getFullYear(), c.getMonth() + n, 1)
  if (view.value === 'week') selected.value = dayKey(addDays(parseDay(selected.value), 7 * n))
}
function goToday() { dir.value = parseDay(today) < cursor.value ? 'prev' : 'next'; cursor.value = new Date(); selected.value = today }
function pick(d) { selected.value = d.key; if (!d.inMonth) { dir.value = d.date < cursor.value ? 'prev' : 'next'; cursor.value = d.date } }

const dayTasks = computed(() => tasksByDay.value[selected.value] ?? [])
const selDate = computed(() => parseDay(selected.value))
const selLabel = computed(() => `${selDate.value.getDate()} ${MONTHS[selDate.value.getMonth()]} ${selDate.value.getFullYear()}`)
const weekday = computed(() => (selected.value === today ? 'Today' : selDate.value.toLocaleDateString('en-MY', { weekday: 'long' })))
const names = (t) => (t.assignedTo ?? []).map((id) => displayOf(board.users[id])).filter(Boolean).join(', ') || 'Nobody yet'
const tone = (t) => (t.completedAt ? 'done' : t.priority)
const CHIP = {
  done: 'bg-accent-soft text-accent line-through', urgent: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200',
  high: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200', medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
}
const DOT = { done: 'bg-accent', urgent: 'bg-red-600', high: 'bg-amber-500', medium: 'bg-blue-600', low: 'bg-slate-400' }

// ----- drag a task to another day (mouse; on a phone, open the task and change its deadline) -----
const dragId = ref('')
const overKey = ref('')
const canMove = (t) => board.canChange(t)
function dragStart(e, t) { dragId.value = t.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id) }
function dragEnd() { dragId.value = ''; overKey.value = '' }
function dragOver(e, d) { if (!dragId.value) return; e.preventDefault(); overKey.value = d.key }
async function drop(d) {
  const t = board.tasks.find((x) => x.id === dragId.value)
  dragEnd()
  if (t) { selected.value = d.key; await board.setDue(t, d.key) }
}
// a new task on the chosen day: the form opens with that deadline
function addOnDay() { editor.openNew(board.activeColumns[0]?.id); pendingDue.value = selected.value }
const pendingDue = ref('')
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="px-4 pt-3 sm:hidden"><ViewSwitch /></div>
    <div class="flex flex-wrap items-center gap-2 px-4 pb-2 pt-3 sm:pt-4">
      <h1 class="mr-1 min-w-[11rem] text-lg font-extrabold sm:text-xl"><Transition name="status-swap" mode="out-in"><span :key="title">{{ title }}</span></Transition></h1>
      <div class="flex items-center gap-1">
        <button type="button" class="btn-ghost press h-10 w-10 p-0" :aria-label="view === 'week' ? 'Previous week' : 'Previous month'" @click="step(-1)"><ChevronLeft class="h-4 w-4" /></button>
        <button type="button" class="btn-ghost press h-10 px-3" @click="goToday">Today</button>
        <button type="button" class="btn-ghost press h-10 w-10 p-0" :aria-label="view === 'week' ? 'Next week' : 'Next month'" @click="step(1)"><ChevronRight class="h-4 w-4" /></button>
      </div>
      <div role="tablist" aria-label="Calendar view" class="relative hidden h-10 w-44 grid-cols-2 rounded-xl bg-line/60 p-[3px] sm:grid">
        <span aria-hidden="true" class="seg-pill absolute left-[3px] top-[3px] h-[34px] w-[calc(50%-3px)] rounded-[9px] bg-surface shadow-sm" :style="{ transform: view === 'week' ? 'translateX(100%)' : 'none' }" />
        <button type="button" role="tab" :aria-selected="view === 'month'" class="relative text-sm font-extrabold" :class="view === 'month' ? 'text-ink' : 'text-muted'" @click="setView('month')">Month</button>
        <button type="button" role="tab" :aria-selected="view === 'week'" class="relative text-sm font-extrabold" :class="view === 'week' ? 'text-ink' : 'text-muted'" @click="setView('week')">Week</button>
      </div>
      <span class="hidden flex-1 sm:block" />
      <BoardPicker />
      <div class="scroll-row w-full"><FilterBar /></div>
    </div>

    <div v-if="board.loading" class="grid flex-1 grid-cols-7 gap-1.5 px-4 pb-4" role="status" aria-label="Loading tasks">
      <span v-for="n in 35" :key="n" class="skeleton min-h-[56px]" :style="{ opacity: 1 - (n % 7) * 0.06 }" />
    </div>
    <div v-else-if="board.error" class="m-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200" role="alert">
      <p class="font-bold">The calendar could not load.</p><p class="mt-1">{{ board.error }}</p><button class="btn-ghost mt-3" @click="board.start()">Try again</button>
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 pb-4 lg:flex-row lg:overflow-hidden">
      <!-- the month or the week -->
      <div class="flex min-w-0 flex-col lg:min-h-0 lg:flex-1">
        <div class="grid grid-cols-7 gap-1.5 pb-1">
          <span v-for="(d, i) in WEEKDAYS" :key="d" class="px-1 text-center text-[11px] font-extrabold uppercase tracking-wide text-muted sm:text-left sm:text-xs"><span class="sm:hidden">{{ d[0] }}</span><span class="hidden sm:inline">{{ d }}</span><span class="sr-only">{{ i }}</span></span>
        </div>
        <Transition :name="`month-${dir}`" mode="out-in">
          <!-- on a big screen the month always fits the page (rows share the height); smaller screens scroll -->
          <div :key="pageKey" class="grid flex-1 grid-cols-7 gap-1.5 lg:min-h-0 lg:auto-rows-[minmax(0,1fr)]" :class="view === 'week' ? 'auto-rows-[minmax(14rem,1fr)]' : 'auto-rows-[minmax(3.25rem,1fr)] sm:auto-rows-[minmax(5rem,1fr)]'">
            <div v-for="d in days" :key="d.key"
              class="flex min-h-0 cursor-pointer flex-col gap-1 overflow-hidden rounded-xl border p-1 sm:p-1.5"
              :class="[selected === d.key ? 'border-accent bg-accent-soft/60 ring-1 ring-accent' : 'border-line bg-surface hover:border-highlight', !d.inMonth && 'opacity-50', overKey === d.key && 'day-drop']"
              role="button" tabindex="0" :aria-label="`${d.date.getDate()} ${MONTHS[d.date.getMonth()]}, ${(tasksByDay[d.key] ?? []).length} tasks`" :aria-pressed="selected === d.key"
              @click="pick(d)" @keydown.enter="pick(d)" @dragover="dragOver($event, d)" @dragleave="overKey === d.key && (overKey = '')" @drop.prevent="drop(d)">
              <span class="mx-auto grid h-7 min-w-[28px] shrink-0 place-items-center rounded-full px-1.5 text-[13px] font-extrabold sm:mx-0 sm:self-start" :class="d.key === today ? 'bg-accent text-on-primary' : ''">{{ view === 'week' ? `${WEEKDAYS[(d.date.getDay() + 6) % 7]} ${d.date.getDate()}` : d.date.getDate() }}</span>
              <!-- phone month: dots; bigger screens: the task names -->
              <span v-if="view === 'month'" class="flex justify-center gap-0.5 sm:hidden"><span v-for="t in (tasksByDay[d.key] ?? []).slice(0, 3)" :key="t.id" class="h-1.5 w-1.5 rounded-full" :class="DOT[tone(t)]" /></span>
              <div class="min-h-0 flex-col gap-1" :class="view === 'month' ? 'hidden sm:flex' : 'flex overflow-auto'">
                <span v-for="t in (tasksByDay[d.key] ?? []).slice(0, view === 'week' ? 50 : 3)" :key="t.id"
                  class="lift truncate rounded-md px-1.5 py-0.5 text-[11px] font-extrabold" :class="[CHIP[tone(t)], dragId === t.id && 'opacity-40', canMove(t) && 'cursor-grab']"
                  :draggable="canMove(t)" :title="t.title" @dragstart="dragStart($event, t)" @dragend="dragEnd" @click.stop="editor.openTask(t)">{{ t.title }}</span>
                <span v-if="view === 'month' && (tasksByDay[d.key] ?? []).length > 3" class="px-1 text-[11px] font-extrabold text-muted">+{{ (tasksByDay[d.key] ?? []).length - 3 }} more</span>
              </div>
            </div>
          </div>
        </Transition>
        <p class="mt-2 hidden text-xs font-bold text-muted sm:block">Tip: drag a task to another day to change its deadline.</p>
      </div>

      <!-- the chosen day -->
      <aside :aria-label="selLabel" class="flex shrink-0 flex-col gap-2 lg:w-80 lg:overflow-auto lg:rounded-2xl lg:border lg:border-line lg:bg-surface lg:p-4">
        <Transition name="status-swap" mode="out-in">
          <div :key="selected">
            <p class="text-xs font-extrabold uppercase tracking-wide text-muted">{{ weekday }}</p>
            <h2 class="text-lg font-extrabold">{{ selLabel }}</h2>
            <p class="text-sm font-bold text-muted">{{ dayTasks.length === 1 ? '1 task due' : `${dayTasks.length} tasks due` }}</p>
          </div>
        </Transition>
        <TransitionGroup tag="ul" name="list" class="flex flex-col gap-2">
          <li v-for="(t, i) in dayTasks" :key="t.id" class="stagger-in" :style="{ '--i': i }">
            <button type="button" class="lift flex w-full items-stretch gap-2.5 rounded-xl border border-line bg-surface p-3 text-left" @click="editor.openTask(t)">
              <span class="w-1 shrink-0 rounded-full" :class="DOT[tone(t)]" />
              <span class="min-w-0 flex-1">
                <span class="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold"><span class="rounded-md px-1.5 py-0.5" :class="priorityOf(t.priority).cls">{{ priorityOf(t.priority).name }}</span><span class="rounded-full bg-accent-soft px-2 py-0.5 text-accent">{{ board.columnNameOf(t) }}</span></span>
                <span class="mt-1 block text-sm font-extrabold leading-snug" :class="t.completedAt && 'text-muted line-through'">{{ t.title }}</span>
                <span class="block truncate text-xs font-bold text-muted">{{ names(t) }}</span>
              </span>
            </button>
          </li>
        </TransitionGroup>
        <p v-if="!dayTasks.length" class="text-sm text-muted">Nothing due on this day.</p>
        <button v-if="board.canEdit" type="button" class="press flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-sm font-extrabold text-accent hover:border-highlight" @click="addOnDay"><Plus class="h-4 w-4" />Add a task on {{ selDate.getDate() }} {{ MONTHS[selDate.getMonth()].slice(0, 3) }}</button>
      </aside>
    </div>
    <TaskModalHost :editor="editor" :default-due="pendingDue" />
  </div>
</template>
