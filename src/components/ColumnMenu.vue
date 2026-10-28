<script setup>
import { ref } from 'vue'
import { MoreHorizontal, Pencil, Archive, Trash2, Check } from 'lucide-vue-next'
import { COLUMN_COLORS } from '@/utils/constants'

const props = defineProps({ column: Object, canDelete: Boolean })
const emit = defineEmits(['rename', 'update', 'archive', 'delete'])

const open = ref(false)
const limit = ref(props.column.limit ?? '')
const close = () => (open.value = false)
const run = (name) => { close(); emit(name) }
function saveLimit() {
  const n = limit.value === '' ? null : Math.max(1, Math.floor(Number(limit.value)))
  if (n !== (props.column.limit ?? null)) emit('update', { limit: n })
}
</script>

<template>
  <div class="relative">
    <button class="rounded p-1 text-muted hover:bg-bg" aria-label="Column options" :aria-expanded="open" @click="open = !open"><MoreHorizontal class="h-4 w-4" /></button>
    <template v-if="open">
      <div class="fixed inset-0 z-20" @click="close" />
      <div class="absolute right-0 top-full z-30 mt-1 w-64 space-y-3 rounded-xl border border-line bg-surface p-3 shadow-xl" role="menu">
        <button class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold hover:bg-bg" @click="run('rename')"><Pencil class="h-4 w-4" />Rename</button>

        <div>
          <span class="label">Colour</span>
          <div class="flex flex-wrap gap-1.5">
            <button class="grid h-6 w-6 place-items-center rounded-full border border-line text-[10px] text-muted" title="No colour" aria-label="No colour" @click="emit('update', { color: '' })"><Check v-if="!column.color" class="h-3 w-3" />–</button>
            <button v-for="c in COLUMN_COLORS" :key="c.id" class="grid h-6 w-6 place-items-center rounded-full" :style="{ background: c.hex }" :title="c.name" :aria-label="c.name" @click="emit('update', { color: c.id })"><Check v-if="column.color === c.id" class="h-3.5 w-3.5 text-white" /></button>
          </div>
        </div>

        <div>
          <label class="label" :for="'lim-' + column.id">Task limit (warns when exceeded)</label>
          <input :id="'lim-' + column.id" v-model="limit" type="number" min="1" class="input py-1" placeholder="No limit" @change="saveLimit" @keydown.enter="saveLimit" />
        </div>

        <label class="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" class="accent-[var(--accent)]" :checked="column.isDone" @change="emit('update', { isDone: $event.target.checked })" />Counts as completed
        </label>

        <div class="border-t border-line pt-2">
          <button class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold hover:bg-bg" @click="run('archive')"><Archive class="h-4 w-4" />Archive column</button>
          <button v-if="canDelete" class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-red-600 hover:bg-bg" @click="run('delete')"><Trash2 class="h-4 w-4" />Delete column</button>
        </div>
      </div>
    </template>
  </div>
</template>
