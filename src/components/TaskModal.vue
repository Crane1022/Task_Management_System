<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { X, Plus, Trash2 } from 'lucide-vue-next'
import { PRIORITIES, DEPARTMENTS, displayOf } from '@/utils/constants'
import { toInput, fromInput } from '@/utils/dates'
import ConfirmDialog from './ConfirmDialog.vue'
import TaskAttachments from './TaskAttachments.vue'
import TaskComments from './TaskComments.vue'
import TaskActivity from './TaskActivity.vue'
import TaskMove from './TaskMove.vue'

const props = defineProps({
  task: Object, // null = creating
  columns: Array,
  users: Object,
  defaultColumnId: String,
  defaultDepartment: String,
  canDelete: Boolean,
  readonly: Boolean, // viewers can look but not change
  canModerate: Boolean, // may delete other people's comments
  liveTask: Object, // the task as it is now (the panel's own copy is from when it was opened)
  boardLabel: { type: String, default: '' }, // "Workspace › Board", for a task that belongs to another board than the one shown
  // creating a task on the Main Board: choose the workspace board it goes to (empty = it goes to the board being shown)
  destinations: { type: Array, default: () => [] },
  currentBoardId: String,
  loadColumns: Function, // (boardId) -> columns of that board
})
const emit = defineEmits(['close', 'create', 'save', 'delete', 'move'])

const t = props.task
const form = ref({
  title: t?.title ?? '',
  description: t?.description ?? '',
  category: t?.category ?? '',
  departmentId: t?.departmentId ?? props.defaultDepartment,
  priority: t?.priority ?? 'medium',
  columnId: t?.columnId ?? props.defaultColumnId,
  assignedTo: [...(t?.assignedTo ?? [])],
  startDate: toInput(t?.startDate),
  dueDate: toInput(t?.dueDate),
  estimatedHours: t?.estimatedHours ?? '',
  labels: (t?.labels ?? []).join(', '),
  subtasks: (t?.subtasks ?? []).map((s) => ({ ...s })),
})
const newSub = ref('')
const confirmDelete = ref(false)
const error = ref('')

// New task on the Main Board: which workspace board does it go to, and which status does that board offer?
const pickDestination = !t && props.destinations.length > 0
const destValue = ref(pickDestination ? (props.destinations.find((d) => d.boardId === props.currentBoardId) ?? props.destinations[0]).value : props.currentBoardId)
const destGroups = computed(() => [...new Set(props.destinations.map((d) => d.group))])
const statusColumns = ref(props.columns ?? [])
watch(destValue, async (v) => {
  if (!pickDestination) return
  const cols = (await props.loadColumns(v)).filter((c) => !c.archived)
  statusColumns.value = cols
  form.value.columnId = cols[0]?.id ?? ''
})
if (pickDestination) props.loadColumns(destValue.value).then((cols) => { statusColumns.value = cols.filter((c) => !c.archived); form.value.columnId = statusColumns.value[0]?.id ?? '' })

onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
const onKey = (e) => e.key === 'Escape' && !confirmDelete.value && emit('close')

const userList = computed(() => Object.values(props.users).sort((a, b) => a.name.localeCompare(b.name)))
const done = computed(() => form.value.subtasks.filter((s) => s.done).length)
const progress = computed(() => (form.value.subtasks.length ? Math.round((done.value / form.value.subtasks.length) * 100) : 0))

function addSub() {
  const title = newSub.value.trim()
  if (!title) return
  form.value.subtasks.push({ id: crypto.randomUUID(), title, done: false })
  newSub.value = ''
}

// Everything the form saves, in Firestore shape
function payload() {
  const f = form.value
  return {
    title: f.title.trim(),
    description: f.description.trim(),
    category: f.category.trim(),
    departmentId: f.departmentId,
    priority: f.priority,
    assignedTo: f.assignedTo,
    startDate: fromInput(f.startDate),
    dueDate: fromInput(f.dueDate),
    estimatedHours: f.estimatedHours === '' ? null : Number(f.estimatedHours),
    labels: f.labels.split(',').map((l) => l.trim()).filter(Boolean),
    subtasks: f.subtasks,
  }
}

function submit() {
  if (!form.value.title.trim()) { error.value = 'Give the task a title.'; return }
  const data = payload()
  if (!t) { emit('create', data, form.value.columnId, destValue.value); return }

  // Edit: send only what changed, and describe each change for the activity log.
  const changes = {}
  const notes = []
  for (const [key, value] of Object.entries(data)) {
    const before = t[key]
    const same = JSON.stringify(key.endsWith('Date') ? toInput(before) : before ?? '') ===
                 JSON.stringify(key.endsWith('Date') ? toInput(value) : value ?? '')
    if (!same) { changes[key] = value; notes.push(`changed ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`) }
  }
  if (form.value.columnId !== t.columnId) changes.columnId = form.value.columnId
  if (!Object.keys(changes).length) { emit('close'); return }
  emit('save', changes, notes)
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex justify-end bg-black/40" @click.self="emit('close')">
    <form class="slide-panel flex h-full w-full max-w-xl flex-col bg-surface shadow-2xl" @submit.prevent="submit">
      <header class="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 class="text-base font-extrabold">{{ t ? 'Task details' : 'New task' }}</h2>
        <button type="button" class="rounded p-1 text-muted hover:bg-bg" aria-label="Close" @click="emit('close')"><X class="h-5 w-5" /></button>
      </header>

      <fieldset :disabled="readonly" class="min-w-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div>
          <label class="label" for="t-title">Title</label>
          <input id="t-title" v-model="form.title" class="input text-base font-bold" placeholder="e.g. Prepare Unit A101 for new tenant" autofocus />
          <p v-if="error" class="mt-1 text-xs font-semibold text-red-600" role="alert">{{ error }}</p>
          <p v-if="boardLabel" class="mt-1 text-[11px] font-bold text-muted">On {{ boardLabel }}</p>
        </div>
        <div v-if="pickDestination">
          <label class="label" for="t-dest">Workspace and board</label>
          <select id="t-dest" v-model="destValue" class="input">
            <optgroup v-for="g in destGroups" :key="g" :label="g"><option v-for="d in destinations.filter((x) => x.group === g)" :key="d.value" :value="d.value">{{ d.boardName ?? d.label }}</option></optgroup>
          </select>
          <p class="mt-1 text-[11px] text-muted">Only boards you may add tasks to are listed. The task appears on that board and on the Main Board.</p>
        </div>
        <div>
          <label class="label" for="t-desc">Description</label>
          <textarea id="t-desc" v-model="form.description" rows="3" class="input" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div><label class="label" for="t-status">Status</label>
            <select id="t-status" v-model="form.columnId" class="input"><option v-for="c in (pickDestination ? statusColumns : columns)" :key="c.id" :value="c.id">{{ c.name }}</option></select></div>
          <div><label class="label" for="t-pri">Priority</label>
            <select id="t-pri" v-model="form.priority" class="input"><option v-for="p in PRIORITIES" :key="p.id" :value="p.id">{{ p.name }}</option></select></div>
          <div><label class="label" for="t-dept">Department</label>
            <select id="t-dept" v-model="form.departmentId" class="input"><option v-for="d in DEPARTMENTS" :key="d.id" :value="d.id">{{ d.name }}</option></select></div>
          <div><label class="label" for="t-cat">Category</label>
            <input id="t-cat" v-model="form.category" class="input" placeholder="e.g. Move-in" /></div>
          <div><label class="label" for="t-start">Start date</label><input id="t-start" v-model="form.startDate" type="date" class="input" /></div>
          <div><label class="label" for="t-due">Deadline</label><input id="t-due" v-model="form.dueDate" type="date" class="input" /></div>
          <div><label class="label" for="t-hrs">Estimated hours</label><input id="t-hrs" v-model="form.estimatedHours" type="number" min="0" step="0.5" class="input" /></div>
          <div><label class="label" for="t-labels">Labels (comma separated)</label><input id="t-labels" v-model="form.labels" class="input" placeholder="Urgent client, Inspection" /></div>
        </div>

        <fieldset>
          <legend class="label">Assigned to</legend>
          <div class="flex flex-wrap gap-2">
            <label v-for="u in userList" :key="u.id"
              class="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
              :class="form.assignedTo.includes(u.id) ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted'">
              <input v-model="form.assignedTo" type="checkbox" :value="u.id" class="sr-only" />{{ displayOf(u) }}
            </label>
          </div>
        </fieldset>

        <div>
          <div class="mb-1 flex items-center justify-between">
            <span class="label mb-0">Checklist</span>
            <span v-if="form.subtasks.length" class="text-xs font-bold text-muted">{{ done }}/{{ form.subtasks.length }} · {{ progress }}%</span>
          </div>
          <div v-if="form.subtasks.length" class="mb-2 h-1.5 overflow-hidden rounded-full bg-line"><div class="h-full bg-accent transition-all" :style="{ width: progress + '%' }" /></div>
          <ul class="space-y-1">
            <li v-for="(s, i) in form.subtasks" :key="s.id" class="flex items-center gap-2">
              <input v-model="s.done" type="checkbox" class="accent-[var(--accent)]" :aria-label="s.title" />
              <span class="flex-1 text-sm" :class="s.done && 'text-muted line-through'">{{ s.title }}</span>
              <button type="button" class="text-muted hover:text-red-600" aria-label="Remove item" @click="form.subtasks.splice(i, 1)"><Trash2 class="h-4 w-4" /></button>
            </li>
          </ul>
          <div class="mt-2 flex gap-2">
            <input v-model="newSub" class="input" placeholder="Add a checklist item" @keydown.enter.prevent="addSub" />
            <button type="button" class="btn-ghost" aria-label="Add item" @click="addSub"><Plus class="h-4 w-4" /></button>
          </div>
        </div>

        <template v-if="t">
          <TaskAttachments :task-id="t.id" :attachments="(liveTask ?? t).attachments ?? []" :can-edit="!readonly" />
          <TaskMove v-if="!readonly" :destinations="destinations" :current-board-id="t.boardId" :load-columns="loadColumns" @move="(d, c) => emit('move', d, c)" />
          <TaskComments :task-id="t.id" :users="users" :can-comment="!readonly" :can-moderate="canModerate" :task="liveTask ?? t" />
          <TaskActivity :task-id="t.id" />
        </template>
      </fieldset>

      <footer class="flex items-center justify-between border-t border-line px-5 py-3">
        <button v-if="t && canDelete" type="button" class="btn-ghost text-red-600" @click="confirmDelete = true"><Trash2 class="h-4 w-4" />Delete</button>
        <span v-else />
        <div class="flex gap-2">
          <button type="button" class="btn-ghost" @click="emit('close')">Cancel</button>
          <button v-if="!readonly" class="btn-primary">{{ t ? 'Save changes' : 'Create task' }}</button>
        </div>
      </footer>
    </form>

    <ConfirmDialog v-if="confirmDelete" title="Delete this task?" message="This permanently removes the task for everyone. This cannot be undone."
      @cancel="confirmDelete = false" @confirm="emit('delete')" />
  </div>
</template>
