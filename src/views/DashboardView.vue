<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { Plus, Settings2, Trash2, Palette } from 'lucide-vue-next'
import { useBoardStore } from '@/stores/board'
import { useDashboardStore } from '@/stores/dashboard'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useStats } from '@/composables/useStats'
import { DEPARTMENTS, displayOf } from '@/utils/constants'
import { WIDGET_TYPES, SIZE_CLASS, CATS, makeWidget } from '@/utils/widgets'
import DashboardWidget from '@/components/DashboardWidget.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import BoardPicker from '@/components/BoardPicker.vue'
import BackgroundDialog from '@/components/BackgroundDialog.vue'

const board = useBoardStore()
const dash = useDashboardStore()
const auth = useAuthStore()
const ui = useUiStore()

onMounted(() => { board.clearFilters(); board.start(); dash.start() })
onUnmounted(() => { board.stop(); dash.stop() })

const scope = reactive({ assignee: '', department: '', days: 0 })
const stats = reactive(useStats(board, scope))
const people = computed(() => Object.values(board.users).sort((a, b) => a.name.localeCompare(b.name)))

const editing = ref(false)
const creating = ref(false)
const newName = ref('')
const confirmDelete = ref(false)
const lookOpen = ref(false)

// Local copy of the widgets so dragging feels instant; Firestore is updated when the drag ends.
const list = ref([])
watch(() => dash.active?.widgets, (v) => (list.value = [...(v ?? [])]), { immediate: true })

const saveOrder = () => dash.save({ widgets: list.value })
const addWidget = (type) => dash.save({ widgets: [...list.value, makeWidget(type)] })
const updateWidget = (id, patch) => dash.save({ widgets: list.value.map((w) => (w.id === id ? { ...w, ...patch } : w)) })
const removeWidget = (id) => dash.save({ widgets: list.value.filter((w) => w.id !== id) })

async function createDash() {
  const name = newName.value.trim()
  if (!name) return
  await dash.create(name)
  newName.value = ''
  creating.value = false
}
async function deleteDash() { await dash.remove(dash.active.id); confirmDelete.value = false; editing.value = false }
// every third widget gets a little cat
const catFor = (i) => (i % 3 === 0 ? CATS[(i / 3) % CATS.length] : '')
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto max-w-7xl px-4 pb-10 pt-4">
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="mr-2 text-lg font-extrabold">Dashboard</h1>
        <BoardPicker />
        <button v-for="d in dash.list" :key="d.id" class="rounded-full border px-3 py-1 text-sm font-bold"
          :class="d.id === dash.active?.id ? 'border-accent bg-accent text-on-primary' : 'border-line bg-surface text-muted hover:text-ink'" @click="dash.select(d.id)">{{ d.name }}</button>
        <form v-if="creating" @submit.prevent="createDash">
          <input v-model="newName" class="input w-44 py-1" placeholder="Dashboard name" aria-label="New dashboard name" autofocus @keydown.esc="creating = false" />
        </form>
        <button v-else class="btn-ghost px-2.5 py-1" title="New dashboard" aria-label="New dashboard" @click="creating = true"><Plus class="h-4 w-4" /></button>
        <button v-if="dash.active" class="btn-ghost ml-auto" :class="editing && 'border-accent text-accent'" @click="editing = !editing"><Settings2 class="h-4 w-4" />{{ editing ? 'Done' : 'Customize' }}</button>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <select v-model="scope.assignee" class="input w-44" aria-label="Employee"><option value="">All employees</option><option v-for="u in people" :key="u.id" :value="u.id">{{ displayOf(u) }}</option></select>
        <select v-if="auth.isAdmin" v-model="scope.department" class="input w-44" aria-label="Department"><option value="">All departments</option><option v-for="d in DEPARTMENTS" :key="d.id" :value="d.id">{{ d.name }}</option></select>
        <select v-model.number="scope.days" class="input w-44" aria-label="Date range"><option :value="0">Any time</option><option :value="7">Created in last 7 days</option><option :value="30">Last 30 days</option><option :value="90">Last 90 days</option></select>
      </div>

      <section v-if="editing && dash.active" class="mt-4 space-y-4 rounded-2xl border border-dashed border-accent bg-surface p-4">
        <div class="flex flex-wrap items-end gap-4">
          <div class="min-w-[200px] flex-1">
            <label class="label" for="d-name">Dashboard name</label>
            <input id="d-name" :value="dash.active.name" class="input" @change="dash.save({ name: $event.target.value.trim() || dash.active.name })" />
          </div>
          <button class="btn-ghost" @click="lookOpen = true"><Palette class="h-4 w-4" />Colours and background</button>
          <button class="btn-ghost text-red-600" :disabled="dash.list.length < 2" :title="dash.list.length < 2 ? 'Keep at least one dashboard' : ''" @click="confirmDelete = true"><Trash2 class="h-4 w-4" />Delete dashboard</button>
        </div>
        <div>
          <span class="label">Add a widget</span>
          <div class="flex flex-wrap gap-2">
            <button v-for="w in WIDGET_TYPES" :key="w.type" class="btn-ghost py-1.5 text-xs" :title="w.hint" @click="addWidget(w.type)"><Plus class="h-3.5 w-3.5" />{{ w.title }}</button>
          </div>
        </div>
        <p class="text-xs text-muted">Drag widgets to reorder them. Use S / M / L to resize and edit a title to rename it. Changes save automatically.</p>
      </section>

      <div v-if="dash.loading || board.loading" class="mt-8 grid gap-4 md:grid-cols-4"><div v-for="n in 4" :key="n" class="skeleton h-28" /></div>
      <div v-else-if="dash.error || board.error" class="mt-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200" role="alert">
        <p class="font-bold">The dashboard could not load.</p><p class="mt-1">{{ dash.error || board.error }}</p>
      </div>
      <template v-else-if="dash.active">
        <VueDraggable v-model="list" :disabled="!editing" :animation="150" filter="input, button" :prevent-on-filter="false" ghost-class="drag-ghost"
          class="mt-9 grid grid-cols-1 gap-x-4 gap-y-9 md:grid-cols-6 lg:grid-cols-12" @end="saveOrder">
          <DashboardWidget v-for="(w, i) in list" :key="w.id" :class="SIZE_CLASS[w.size]" :widget="w" :stats="stats" :editing="editing" :cat="catFor(i)"
            @update="(patch) => updateWidget(w.id, patch)" @remove="removeWidget(w.id)" />
        </VueDraggable>
        <p v-if="!list.length" class="mt-10 text-center text-sm text-muted">This dashboard is empty. Press Customize to add widgets.</p>
      </template>
    </div>

    <BackgroundDialog v-if="lookOpen && dash.active" :dashboard-id="dash.active.id" @close="lookOpen = false" />
    <ConfirmDialog v-if="confirmDelete" title="Delete this dashboard?" :message="`“${dash.active.name}” and its layout will be removed. Your tasks are not affected.`" @cancel="confirmDelete = false" @confirm="deleteDash" />
  </div>
</template>
