<script setup>
import { ref, computed } from 'vue'
import { ArrowRightLeft, UserPlus, Flag, CalendarDays, Trash2, X } from 'lucide-vue-next'
import { useBoardStore } from '@/stores/board'
import { PRIORITIES, displayOf } from '@/utils/constants'
import { useUiStore } from '@/stores/ui'

// The bar that rises from the bottom when tasks are ticked on the List page (26 Nov 2026).
const props = defineProps({ tasks: Array }) // the selected tasks
const emit = defineEmits(['clear', 'done'])
const board = useBoardStore()
const ui = useUiStore()

const open = ref('') // which little menu is open: column | assign | priority | due
const due = ref('')
const busy = ref(false)
// column names on the boards of the selected tasks (a task moves to the column with that name on its own board)
const columnNames = computed(() => [...new Set(board.activeColumns.map((c) => c.name))])
const people = computed(() => Object.values(board.users).filter((u) => !u.disabled).sort((a, b) => displayOf(a).localeCompare(displayOf(b))))
const toggle = (k) => (open.value = open.value === k ? '' : k)

async function apply(kind, value) {
  open.value = ''
  busy.value = true
  try { if (await ui.track(() => board.bulkChange(props.tasks, kind, value))) emit('done') } finally { busy.value = false }
}
function remove() { open.value = ''; if (board.bulkRemove(props.tasks)) emit('done') }
const actions = [
  { k: 'column', label: 'Move to', icon: ArrowRightLeft },
  { k: 'assign', label: 'Assign', icon: UserPlus },
  { k: 'priority', label: 'Priority', icon: Flag },
  { k: 'due', label: 'Deadline', icon: CalendarDays },
]
</script>

<template>
  <div class="pointer-events-none fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-40 flex justify-center sm:bottom-6">
    <div role="toolbar" aria-label="Change the selected tasks" class="pointer-events-auto relative flex max-w-full items-center gap-1 rounded-2xl bg-ink p-1.5 text-bg shadow-2xl" :aria-busy="busy || null">
      <span class="hidden whitespace-nowrap px-3 text-sm font-extrabold sm:inline">{{ tasks.length }} selected</span>
      <span class="hidden h-6 w-px bg-bg/20 sm:block" />
      <button v-for="a in actions" :key="a.k" type="button" class="press flex h-11 min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[11px] font-extrabold hover:bg-bg/10 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm" :class="open === a.k && 'bg-bg/15'" :aria-expanded="open === a.k" @click="toggle(a.k)"><component :is="a.icon" class="h-[18px] w-[18px]" />{{ a.label }}</button>
      <button type="button" class="press flex h-11 min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[11px] font-extrabold text-red-300 hover:bg-bg/10 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm" @click="remove"><Trash2 class="h-[18px] w-[18px]" />Delete</button>
      <button type="button" class="press hidden h-11 w-11 place-items-center rounded-xl bg-bg/10 sm:grid" aria-label="Clear the selection" @click="emit('clear')"><X class="h-4 w-4" /></button>

      <!-- the small menus open above the bar -->
      <div v-if="open" class="absolute bottom-full left-1/2 mb-2 w-72 max-w-[calc(100vw-1rem)] -translate-x-1/2">
      <div class="reveal rounded-xl border border-line bg-surface p-2 text-ink shadow-xl" role="menu">
        <template v-if="open === 'column'">
          <p class="px-2 pb-1 text-xs font-bold text-muted">Move {{ tasks.length }} to…</p>
          <button v-for="n in columnNames" :key="n" type="button" role="menuitem" class="flex min-h-[44px] w-full items-center rounded-lg px-2 text-left text-sm font-bold hover:bg-bg" @click="apply('column', n)">{{ n }}</button>
        </template>
        <template v-else-if="open === 'assign'">
          <p class="px-2 pb-1 text-xs font-bold text-muted">Add a person to {{ tasks.length }} task{{ tasks.length === 1 ? '' : 's' }}</p>
          <div class="max-h-64 overflow-auto"><button v-for="u in people" :key="u.id" type="button" role="menuitem" class="flex min-h-[44px] w-full items-center rounded-lg px-2 text-left text-sm font-bold hover:bg-bg" @click="apply('assign', u.id)">{{ displayOf(u) }}</button></div>
        </template>
        <template v-else-if="open === 'priority'">
          <button v-for="p in PRIORITIES" :key="p.id" type="button" role="menuitem" class="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-bold hover:bg-bg" @click="apply('priority', p.id)"><span class="rounded-md px-1.5 py-0.5 text-xs" :class="p.cls">{{ p.name }}</span></button>
        </template>
        <template v-else-if="open === 'due'">
          <label class="label" for="bulk-due">New deadline</label>
          <input id="bulk-due" v-model="due" type="date" class="input" />
          <div class="mt-2 flex justify-between gap-2">
            <button type="button" class="btn-ghost py-1" @click="apply('due', '')">Remove deadline</button>
            <button type="button" class="btn-primary py-1" :disabled="!due" @click="apply('due', due)">Set</button>
          </div>
        </template>
      </div>
      </div>
    </div>
  </div>
</template>
