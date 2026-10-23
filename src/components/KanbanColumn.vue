<script setup>
import { ref, watch, computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { Plus, Check, GripVertical, CircleCheck } from 'lucide-vue-next'
import { columnColor } from '@/utils/constants'
import TaskCard from './TaskCard.vue'
import CatPeek from './CatPeek.vue'
import ColumnMenu from './ColumnMenu.vue'

const props = defineProps({ column: Object, tasks: Array, total: Number, users: Object, canManage: Boolean, canDelete: Boolean, canEdit: { type: Boolean, default: true }, cat: String })
const emit = defineEmits(['open', 'add', 'drop', 'rename', 'update', 'archive', 'delete'])

// Local copy so the library can reorder it while dragging; it resets whenever Firestore pushes new data.
const list = ref([...props.tasks])
watch(() => props.tasks, (v) => (list.value = [...v]))

const color = computed(() => columnColor(props.column.color))
const over = computed(() => props.column.limit && props.total > props.column.limit)

const editing = ref(false)
const name = ref('')
function startEdit() { name.value = props.column.name; editing.value = true }
function saveName() {
  const n = name.value.trim()
  if (n && n !== props.column.name) emit('rename', n)
  editing.value = false
}

// Read the final on-screen order of the target column, so the saved position matches what the user sees.
function onDrop(evt) {
  const ids = [...evt.to.children].map((el) => el.dataset.id).filter(Boolean)
  emit('drop', { taskId: evt.item.dataset.id, columnId: evt.to.dataset.columnId, ids })
}
</script>

<template>
  <section class="relative flex max-h-full w-72 shrink-0 flex-col rounded-2xl border border-line bg-surface">
    <CatPeek v-if="cat" :variant="cat" />
    <div v-if="color" class="mx-3 mt-3 h-1 rounded-full" :style="{ background: color }" />

    <header class="flex items-center gap-1 px-2 pb-1" :class="color ? 'pt-2' : 'pt-3'">
      <button v-if="canManage" class="col-handle cursor-grab touch-none rounded p-1 text-muted hover:bg-bg active:cursor-grabbing" title="Drag to reorder this column" aria-label="Drag to reorder this column"><GripVertical class="h-4 w-4" /></button>
      <template v-if="!editing">
        <h2 class="truncate text-xs font-extrabold tracking-wide">{{ column.name }}</h2>
        <CircleCheck v-if="column.isDone" class="h-3.5 w-3.5 shrink-0 text-accent" title="Counts as completed" />
        <span class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" :class="over ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200' : 'bg-bg text-muted'"
          :title="over ? `Over the limit of ${column.limit} tasks` : ''">{{ total }}<template v-if="column.limit"> / {{ column.limit }}</template></span>
        <div class="ml-auto flex items-center gap-0.5 text-muted">
          <button v-if="canEdit" class="rounded p-1 hover:bg-bg hover:text-accent" title="Add task" aria-label="Add task" @click="emit('add')"><Plus class="h-4 w-4" /></button>
          <ColumnMenu v-if="canManage" :column="column" :can-delete="canDelete" @rename="startEdit" @update="(c) => emit('update', c)" @archive="emit('archive')" @delete="emit('delete')" />
        </div>
      </template>
      <template v-else>
        <input v-model="name" class="input py-1" aria-label="Column name" autofocus @keydown.enter="saveName" @keydown.esc="editing = false" />
        <button class="btn-primary px-2 py-1" aria-label="Save name" @click="saveName"><Check class="h-4 w-4" /></button>
      </template>
    </header>

    <VueDraggable
      v-model="list" group="tasks" :disabled="!canEdit" :animation="150" ghost-class="drag-ghost"
      class="flex min-h-[80px] flex-1 flex-col gap-2 overflow-y-auto p-3"
      :data-column-id="column.id" @add="onDrop" @update="onDrop"
    >
      <TaskCard v-for="t in list" :key="t.id" :data-id="t.id" :task="t" :users="users" @click="emit('open', t)" />
    </VueDraggable>
    <p v-if="!list.length" class="-mt-14 px-3 pb-6 text-center text-xs text-muted">No tasks here. Drop one in or press +.</p>
  </section>
</template>
