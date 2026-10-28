<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { COLUMN_COLORS, WORKSPACE_ICONS } from '@/utils/constants'
import WorkspaceAvatar from './WorkspaceAvatar.vue'
import { Lock } from 'lucide-vue-next'

const emit = defineEmits(['close', 'created'])
const store = useWorkspaceStore()
const form = ref({ name: '', description: '', icon: '', color: 'sage', superPrivate: false })
const busy = ref(false)
const error = ref('')

// Escape closes it, like the other dialogs
const onKey = (e) => { if (e.key === 'Escape') emit('close') }
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

async function submit() {
  if (!form.value.name.trim()) { error.value = 'Give the workspace a name.'; return }
  busy.value = true
  const id = await store.addWorkspace({ ...form.value, name: form.value.name.trim(), description: form.value.description.trim() })
  busy.value = false
  if (id) emit('created', id)
}
</script>

<template>
  <!-- Teleported to the page itself: inside the sidebar the dialog was squeezed into the sidebar's width -->
  <Teleport to="body">
  <div class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" @click.self="emit('close')">
    <form class="my-auto w-full max-w-xl rounded-2xl bg-surface p-5 shadow-xl sm:p-6" role="dialog" aria-modal="true" aria-label="Create workspace" @submit.prevent="submit">
      <h2 class="flex items-center gap-2 text-base font-extrabold"><WorkspaceAvatar :workspace="form" :size="28" />Create a workspace</h2>
      <p class="mt-1 text-sm text-muted">A workspace is a department or working group. It holds boards, and only its members can see them. You become its owner and admin.</p>
      <div class="mt-4 space-y-4">
        <div><label class="label" for="ws-name">Name</label><input id="ws-name" v-model="form.name" class="input" maxlength="80" placeholder="e.g. Operation Workspace" autofocus /></div>
        <div><label class="label" for="ws-desc">Description (optional)</label><textarea id="ws-desc" v-model="form.description" rows="2" class="input" maxlength="300" /></div>
        <div>
          <span class="label">Icon</span>
          <div class="flex flex-wrap gap-1.5">
            <button type="button" class="grid h-8 w-8 place-items-center rounded-lg border text-xs font-bold text-muted" :class="!form.icon ? 'border-accent ring-2 ring-accent' : 'border-line'" title="First letter of the name" @click="form.icon = ''">Aa</button>
            <button v-for="i in WORKSPACE_ICONS" :key="i" type="button" class="grid h-8 w-8 place-items-center rounded-lg border text-base" :class="form.icon === i ? 'border-accent ring-2 ring-accent' : 'border-line'" :aria-label="'Icon ' + i" @click="form.icon = i">{{ i }}</button>
          </div>
        </div>
        <div>
          <span class="label">Colour</span>
          <div class="flex gap-1.5">
            <button v-for="c in COLUMN_COLORS" :key="c.id" type="button" class="h-7 w-7 rounded-full border-2" :class="form.color === c.id ? 'border-ink' : 'border-transparent'" :style="{ background: c.hex }" :title="c.name" :aria-label="c.name" @click="form.color = c.id" />
          </div>
        </div>
        <label class="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3" :class="form.superPrivate ? 'border-accent bg-accent-soft' : 'border-line'">
          <input v-model="form.superPrivate" type="checkbox" class="mt-0.5 accent-[var(--accent)]" />
          <span>
            <span class="flex items-center gap-1 text-sm font-bold"><Lock class="h-3.5 w-3.5" />Super Private Workspace</span>
            <span class="mt-0.5 block text-xs text-muted">Only you (the owner) and the people you add can open it, its boards and its tasks. Directors, Department Managers and admins get no access from their job. Nobody else can add members.</span>
          </span>
        </label>
      </div>
      <p v-if="error" class="mt-3 text-sm font-semibold text-red-600" role="alert">{{ error }}</p>
      <div class="mt-5 flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="emit('close')">Cancel</button>
        <button class="btn-primary" :disabled="busy">{{ busy ? 'Creating…' : 'Create workspace' }}</button>
      </div>
    </form>
  </div>
  </Teleport>
</template>
