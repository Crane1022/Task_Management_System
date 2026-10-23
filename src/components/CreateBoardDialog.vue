<script setup>
import { ref, computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import BackgroundSwatches from './BackgroundSwatches.vue'

const props = defineProps({ workspaceId: String })
const emit = defineEmits(['close', 'created'])
const store = useWorkspaceStore()

const form = ref({ name: '', description: '', background: { type: 'color', color: 'sage' }, structure: 'default', copyFrom: '' })
const busy = ref(false)
const error = ref('')
const others = computed(() => (store.boards[props.workspaceId] ?? []).filter((b) => !b.archived))

async function submit() {
  const f = form.value
  if (!f.name.trim()) { error.value = 'Give the board a name.'; return }
  if (f.structure === 'copy' && !f.copyFrom) { error.value = 'Choose the board to copy the columns from.'; return }
  busy.value = true
  const id = await store.addBoard(props.workspaceId, {
    name: f.name.trim(), description: f.description.trim(), background: f.background,
    copyFrom: f.structure === 'copy' ? f.copyFrom : '', starterColumns: f.structure === 'default',
  })
  busy.value = false
  if (id) emit('created', id)
}
</script>

<template>
  <div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/40 p-4" @click.self="emit('close')">
    <form class="my-4 w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl" role="dialog" aria-modal="true" aria-label="Create board" @submit.prevent="submit">
      <h2 class="text-base font-extrabold">Create a board</h2>
      <div class="mt-4 space-y-3">
        <div><label class="label" for="b-name">Board name</label><input id="b-name" v-model="form.name" class="input" maxlength="80" placeholder="e.g. Property Management" autofocus /></div>
        <div><label class="label" for="b-desc">Description (optional)</label><textarea id="b-desc" v-model="form.description" rows="2" class="input" maxlength="300" /></div>
        <div><span class="label">Background</span><BackgroundSwatches v-model="form.background" /></div>
        <fieldset>
          <legend class="label">Columns</legend>
          <label class="flex items-center gap-2 text-sm font-semibold"><input v-model="form.structure" type="radio" value="default" class="accent-[var(--accent)]" />Standard set (NEW PROJECT, TODO, DOING, REVIEW, DONE)</label>
          <label class="mt-1 flex items-center gap-2 text-sm font-semibold"><input v-model="form.structure" type="radio" value="copy" class="accent-[var(--accent)]" :disabled="!others.length" />Copy the columns of another board (no tasks are copied)</label>
          <select v-if="form.structure === 'copy'" v-model="form.copyFrom" class="input mt-2" aria-label="Board to copy columns from"><option value="">Choose a board…</option><option v-for="b in others" :key="b.id" :value="b.id">{{ b.name }}</option></select>
          <label class="mt-1 flex items-center gap-2 text-sm font-semibold"><input v-model="form.structure" type="radio" value="empty" class="accent-[var(--accent)]" />Start empty (add columns yourself)</label>
        </fieldset>
      </div>
      <p v-if="error" class="mt-3 text-sm font-semibold text-red-600" role="alert">{{ error }}</p>
      <div class="mt-5 flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="emit('close')">Cancel</button>
        <button class="btn-primary" :disabled="busy">{{ busy ? 'Creating…' : 'Create board' }}</button>
      </div>
    </form>
  </div>
</template>
