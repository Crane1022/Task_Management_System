<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { Plus } from 'lucide-vue-next'
import { useBoardStore } from '@/stores/board'
import { useTaskEditor } from '@/composables/useTaskEditor'
import { priorityOf, deptName, displayOf } from '@/utils/constants'
import { formatDate, dueState } from '@/utils/dates'
import FilterBar from '@/components/FilterBar.vue'
import BoardPicker from '@/components/BoardPicker.vue'
import TaskToolbar from '@/components/TaskToolbar.vue'
import TaskModalHost from '@/components/TaskModalHost.vue'

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
const names = (t) => (t.assignedTo ?? []).map((id) => displayOf(board.users[id])).filter(Boolean).join(', ') || '—'
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex flex-wrap items-center gap-2 px-4 pb-2 pt-4">
      <h1 class="mr-2 text-lg font-extrabold">List<span v-if="board.boardName" class="text-sm font-bold text-muted"> · {{ board.boardName }}</span><span v-if="shown" class="text-sm font-bold text-accent"> · {{ shown }} ({{ rows.length }})</span></h1>
      <BoardPicker />
      <FilterBar />
      <TaskToolbar />
      <select v-model="sort" class="input w-44" aria-label="Sort tasks">
        <option value="due">Sort: deadline</option><option value="priority">Sort: priority</option><option value="new">Sort: newest</option>
      </select>
    </div>

    <div v-if="board.loading" class="space-y-2 px-4 pt-2"><div v-for="n in 6" :key="n" class="skeleton h-12" /></div>
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
      <table class="w-full min-w-[760px] border-separate border-spacing-y-1.5 text-left text-sm">
        <thead class="text-xs font-bold text-muted">
          <tr><th class="px-3 py-1">Task</th><th class="px-3 py-1">Status</th><th class="px-3 py-1">Assigned to</th><th class="px-3 py-1">Priority</th><th class="px-3 py-1">Department</th><th class="px-3 py-1">Deadline</th></tr>
        </thead>
        <tbody>
          <tr v-for="t in rows" :key="t.id" tabindex="0" class="group cursor-pointer" @click="editor.openTask(t)" @keydown.enter="editor.openTask(t)">
            <td class="rounded-l-xl border-y border-l border-line bg-surface px-3 py-2.5 font-bold group-hover:border-highlight group-focus-visible:border-accent">{{ t.title }}</td>
            <td class="border-y border-line bg-surface px-3 py-2.5 group-hover:border-highlight">{{ board.columnNameOf(t) }}</td>
            <td class="border-y border-line bg-surface px-3 py-2.5 group-hover:border-highlight">{{ names(t) }}</td>
            <td class="border-y border-line bg-surface px-3 py-2.5 group-hover:border-highlight"><span class="rounded-md px-1.5 py-0.5 text-xs font-semibold" :class="priorityOf(t.priority).cls">{{ priorityOf(t.priority).name }}</span></td>
            <td class="border-y border-line bg-surface px-3 py-2.5 group-hover:border-highlight">{{ deptName(t.departmentId) }}</td>
            <td class="rounded-r-xl border-y border-r border-line bg-surface px-3 py-2.5 group-hover:border-highlight" :class="{ 'font-bold text-red-600': dueState(t) === 'overdue' }">{{ formatDate(t.dueDate) || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <TaskModalHost :editor="editor" />
  </div>
</template>
