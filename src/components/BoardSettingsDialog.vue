<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { X, Copy, Archive, ArchiveRestore, Trash2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '@/stores/workspace'
import { useUiStore } from '@/stores/ui'
import { WORKSPACE_ROLES } from '@/utils/permissions'
import { displayOf } from '@/utils/constants'
import BackgroundSwatches from './BackgroundSwatches.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import UserAvatar from './UserAvatar.vue'

// Board admins: rename, background, board-level roles, duplicate the structure, archive / restore, delete an empty board.
const props = defineProps({ board: Object, workspace: Object, users: Object })
const emit = defineEmits(['close'])
const router = useRouter()
const store = useWorkspaceStore()
const ui = useUiStore()

const form = ref({ name: props.board.name, description: props.board.description ?? '', background: props.board.background ?? { type: 'color', color: 'sage' } })
const copyName = ref(`${props.board.name} (copy)`)
const confirm = ref('') // 'archive' | 'delete'
const busy = ref(false)

const onKey = (e) => e.key === 'Escape' && !confirm.value && emit('close')
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))

const people = computed(() => Object.entries(props.workspace?.members ?? {})
  .map(([uid, wsRole]) => ({ uid, wsRole, user: props.users?.[uid], override: props.board.members?.[uid] ?? '' }))
  .sort((a, b) => displayOf(a.user).localeCompare(displayOf(b.user))))

async function save() {
  if (!form.value.name.trim()) { ui.toast('Give the board a name', 'error'); return }
  busy.value = true
  await store.saveBoard(props.board.id, { name: form.value.name.trim(), description: form.value.description.trim(), background: form.value.background })
  busy.value = false
}
async function duplicate() {
  if (!copyName.value.trim()) return
  busy.value = true
  const id = await store.addBoard(props.board.workspaceId, {
    name: copyName.value.trim(), description: form.value.description.trim(), background: form.value.background, copyFrom: props.board.id,
  })
  busy.value = false
  if (id) { emit('close'); router.push(`/b/${id}`) }
}
async function archive(on) {
  confirm.value = ''
  await store.saveBoard(props.board.id, { archived: on }, on ? 'Board archived' : 'Board restored')
}
async function remove() {
  confirm.value = ''
  if (await store.removeBoard(props.board.id)) { emit('close'); router.push(`/workspaces/${props.board.workspaceId}`) }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" @click.self="emit('close')">
    <div class="my-4 w-full max-w-xl rounded-2xl bg-surface p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="Board settings">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-extrabold">Board settings</h2>
        <button class="rounded p-1 text-muted hover:bg-bg" aria-label="Close" @click="emit('close')"><X class="h-5 w-5" /></button>
      </div>

      <section class="mt-4 space-y-3">
        <div><label class="label" for="bs-name">Name</label><input id="bs-name" v-model="form.name" class="input" maxlength="80" /></div>
        <div><label class="label" for="bs-desc">Description</label><textarea id="bs-desc" v-model="form.description" rows="2" class="input" maxlength="300" /></div>
        <div><span class="label">Background</span><BackgroundSwatches v-model="form.background" /></div>
        <button class="btn-primary" :disabled="busy" @click="save">Save changes</button>
      </section>

      <section class="mt-6">
        <h3 class="text-sm font-extrabold">Who can do what on this board</h3>
        <p class="mt-1 text-xs text-muted">Everyone in the workspace can open this board with their workspace role. Here you can give one person a different role on this board only. Workspace admins are always admins.</p>
        <ul class="mt-2 max-h-64 space-y-1 overflow-y-auto">
          <li v-for="p in people" :key="p.uid" class="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5">
            <UserAvatar :user="p.user" :size="26" />
            <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ displayOf(p.user) }}</span>
            <span v-if="p.wsRole === 'admin'" class="text-xs font-bold text-muted">Workspace admin</span>
            <select v-else :value="p.override" class="input w-44 py-1" :aria-label="`Role of ${displayOf(p.user)} on this board`" @change="store.setBoardRole(board.id, p.uid, $event.target.value || null)">
              <option value="">Same as workspace ({{ p.wsRole }})</option>
              <option v-for="r in WORKSPACE_ROLES" :key="r.id" :value="r.id">{{ r.name }} on this board</option>
            </select>
          </li>
        </ul>
      </section>

      <section v-if="board.id !== 'main'" class="mt-6">
        <h3 class="text-sm font-extrabold">Duplicate the structure</h3>
        <p class="mt-1 text-xs text-muted">Makes a new board with the same columns and settings. No tasks are copied.</p>
        <div class="mt-2 flex gap-2"><input v-model="copyName" class="input" maxlength="80" aria-label="Name of the copy" /><button class="btn-ghost" :disabled="busy" @click="duplicate"><Copy class="h-4 w-4" />Duplicate</button></div>
      </section>

      <section class="mt-6 border-t border-line pt-4">
        <div class="flex flex-wrap gap-2">
          <button v-if="!board.archived" class="btn-ghost" @click="confirm = 'archive'"><Archive class="h-4 w-4" />Archive board</button>
          <button v-else class="btn-ghost" @click="archive(false)"><ArchiveRestore class="h-4 w-4" />Restore board</button>
          <button v-if="board.archived && board.id !== 'main'" class="btn-ghost text-red-600" @click="confirm = 'delete'"><Trash2 class="h-4 w-4" />Delete board</button>
        </div>
        <p class="mt-2 text-xs text-muted">Archiving hides the board from the workspace but keeps every task. Deleting is only possible for an archived board that has no tasks.</p>
      </section>
    </div>
    <ConfirmDialog v-if="confirm === 'archive'" title="Archive this board?" message="It is hidden from the workspace overview. Its tasks and columns are kept, and you can restore it at any time." confirm-text="Archive" @cancel="confirm = ''" @confirm="archive(true)" />
    <ConfirmDialog v-if="confirm === 'delete'" title="Delete this board?" message="This permanently deletes the board and its columns. It only works when the board has no tasks." confirm-text="Delete" @cancel="confirm = ''" @confirm="remove" />
  </div>
</template>
