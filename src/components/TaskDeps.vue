<script setup>
import { ref, computed, nextTick } from 'vue'
import { Link2, Lock, Check, X, ArrowRight, Plus } from 'lucide-vue-next'
import { useBoardStore } from '@/stores/board'
import { blockersOf, holdingUp, openBlockers, MAX_BLOCKERS } from '@/utils/deps'

// Task dependencies (26 Nov 2026): the tasks this one waits on (they must be finished first) and the ones it holds up.
// A task that still waits on something cannot be moved to a "completed" column (the board store checks it).
const props = defineProps({ task: Object, canEdit: Boolean })
const board = useBoardStore()

const before = computed(() => blockersOf(props.task, board.tasks))
const open = computed(() => openBlockers(props.task, board.tasks))
const after = computed(() => holdingUp(props.task, board.tasks))
const done = computed(() => before.value.filter((b) => b.done).length)
const visible = computed(() => before.value.filter((b) => b.task).length)
const progress = computed(() => (visible.value ? Math.round((done.value / visible.value) * 100) : 100))

const picking = ref(false)
const query = ref('')
const box = ref(null)
const options = computed(() => {
  const q = query.value.trim().toLowerCase()
  const taken = new Set([props.task.id, ...(props.task.blockedBy ?? [])])
  return board.tasks
    .filter((t) => !taken.has(t.id) && (!q || t.title.toLowerCase().includes(q)))
    .sort((a, b) => !!a.completedAt - !!b.completedAt || (a.dueDate?.toMillis?.() ?? 9e15) - (b.dueDate?.toMillis?.() ?? 9e15))
    .slice(0, 8)
})
async function startPick() { picking.value = true; query.value = ''; await nextTick(); box.value?.focus() }
const busy = ref('')
async function add(t) { busy.value = t.id; try { if (await board.addBlocker(props.task, t.id)) picking.value = false } finally { busy.value = '' } }
async function remove(id) { busy.value = id; try { await board.removeBlocker(props.task, id) } finally { busy.value = '' } }
</script>

<template>
  <section aria-label="Dependencies">
    <span class="label mb-1 flex items-center gap-1"><Link2 class="h-3.5 w-3.5" />Dependencies</span>

    <!-- what the task waits on: amber while something is open, green when everything is done -->
    <div v-if="visible" class="mb-2 flex items-start gap-3 rounded-xl border p-3" role="status"
      :class="open.length ? 'border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-950/30' : 'border-emerald-300 bg-emerald-50 dark:border-emerald-700/60 dark:bg-emerald-950/30'">
      <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white" :class="open.length ? 'bg-amber-500' : 'bg-emerald-600'">
        <Transition name="status-swap" mode="out-in"><Lock v-if="open.length" key="l" class="h-4 w-4" /><Check v-else key="c" class="h-4 w-4" /></Transition>
      </span>
      <div class="min-w-0 flex-1">
        <Transition name="status-swap" mode="out-in">
          <p :key="open.length ? 'w' : 'r'" class="text-sm font-extrabold">{{ open.length ? `Waiting on ${open.length} task${open.length === 1 ? '' : 's'}` : 'Ready to finish' }}</p>
        </Transition>
        <p class="text-xs text-muted">{{ open.length ? 'It can’t be moved to a completed column until these are finished. You can still edit it.' : 'Everything it waits on is done.' }}</p>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><div class="h-full rounded-full transition-[width] duration-500" :class="open.length ? 'bg-amber-500' : 'bg-emerald-600'" :style="{ width: progress + '%' }" /></div>
      </div>
    </div>

    <p class="mb-1 text-xs font-bold text-muted">Waiting on (must finish first)</p>
    <TransitionGroup tag="ul" name="list" class="space-y-1.5">
      <li v-for="b in before" :key="b.id" class="flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-1.5" :class="b.done && 'bg-bg'">
        <span class="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2" :class="b.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-line'"><Check v-if="b.done" class="tick-pop h-3 w-3" /></span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-bold" :class="b.done && 'text-muted line-through'">{{ b.task?.title ?? 'A task you can’t see' }}</p>
          <p v-if="b.task" class="truncate text-[11px] text-muted">{{ b.done ? 'Done' : board.columnNameOf(b.task) }}<template v-if="board.boardLabelOf(b.task)"> · {{ board.boardLabelOf(b.task) }}</template></p>
        </div>
        <button v-if="canEdit" type="button" v-busy="busy === b.id" class="rounded p-1 text-muted hover:text-red-600" :aria-label="`Stop waiting on ${b.task?.title ?? 'this task'}`" @click="remove(b.id)"><X class="h-4 w-4" /></button>
      </li>
    </TransitionGroup>
    <p v-if="!before.length" class="text-xs text-muted">Nothing. {{ canEdit ? 'Add a task that has to be finished before this one.' : '' }}</p>

    <div v-if="canEdit" class="relative mt-2">
      <button v-if="!picking" type="button" class="press flex min-h-[36px] items-center gap-1 rounded-full border border-dashed border-line px-3 text-xs font-bold text-accent disabled:opacity-50" :disabled="(task.blockedBy ?? []).length >= MAX_BLOCKERS" @click="startPick"><Plus class="h-3.5 w-3.5" />Add a task it waits on</button>
      <div v-else class="reveal rounded-xl border border-line bg-surface p-2 shadow-lg">
        <input ref="box" v-model="query" type="search" class="input" placeholder="Find a task…" aria-label="Find a task this one waits on" @keydown.esc="picking = false" />
        <ul class="mt-1 max-h-56 overflow-auto">
          <li v-for="o in options" :key="o.id">
            <button type="button" v-busy="busy === o.id" class="flex min-h-[44px] w-full flex-col items-start justify-center rounded-lg px-2 text-left hover:bg-bg" @click="add(o)">
              <span class="truncate text-sm font-bold">{{ o.title }}</span>
              <span class="text-[11px] text-muted">{{ o.completedAt ? 'Done' : board.columnNameOf(o) }}<template v-if="board.boardLabelOf(o)"> · {{ board.boardLabelOf(o) }}</template></span>
            </button>
          </li>
          <li v-if="!options.length" class="px-2 py-3 text-xs text-muted">No matching tasks on this board.</li>
        </ul>
        <div class="mt-1 flex justify-end"><button type="button" class="btn-ghost py-1 text-xs" @click="picking = false">Cancel</button></div>
      </div>
    </div>

    <template v-if="after.length">
      <p class="mb-1 mt-3 text-xs font-bold text-muted">Holding up (these wait for this task)</p>
      <ul class="space-y-1.5">
        <li v-for="t in after" :key="t.id" class="flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-1.5"><ArrowRight class="h-4 w-4 shrink-0 text-muted" /><span class="min-w-0 flex-1 truncate text-sm font-bold">{{ t.title }}</span><span class="text-[11px] text-muted">{{ board.columnNameOf(t) }}</span></li>
      </ul>
    </template>
  </section>
</template>
