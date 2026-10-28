<script setup>
import { ref, computed, watch } from 'vue'
import { ArrowRightLeft } from 'lucide-vue-next'

// Move the task (the same record) to a column of another workspace board. Only boards the person may add tasks to are listed.
const props = defineProps({ destinations: { type: Array, default: () => [] }, currentBoardId: String, loadColumns: Function })
const emit = defineEmits(['move'])

const options = computed(() => props.destinations.filter((d) => d.boardId !== props.currentBoardId))
const groups = computed(() => [...new Set(options.value.map((d) => d.group))])
const dest = ref('')
const columns = ref([])
const columnId = ref('')
const busy = ref(false)
watch(dest, async (v) => {
  columns.value = []; columnId.value = ''
  if (!v) return
  const cols = (await props.loadColumns(v)).filter((c) => !c.archived)
  columns.value = cols; columnId.value = cols[0]?.id ?? ''
})
async function go() { busy.value = true; emit('move', dest.value, columnId.value) }
</script>

<template>
  <details v-if="options.length" class="rounded-xl border border-line px-3 py-2">
    <summary class="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-muted"><ArrowRightLeft class="h-3.5 w-3.5" />Move to another workspace or board</summary>
    <div class="mt-3 grid gap-2 sm:grid-cols-2">
      <div><label class="label" for="mv-dest">Move to</label>
        <select id="mv-dest" v-model="dest" class="input"><option value="">Choose a board…</option>
          <optgroup v-for="g in groups" :key="g" :label="g"><option v-for="d in options.filter((x) => x.group === g)" :key="d.value" :value="d.value">{{ d.boardName ?? d.label }}</option></optgroup></select></div>
      <div><label class="label" for="mv-col">Column</label>
        <select id="mv-col" v-model="columnId" class="input" :disabled="!columns.length"><option v-for="c in columns" :key="c.id" :value="c.id">{{ c.name }}</option></select></div>
    </div>
    <p class="mt-1 text-[11px] text-muted">It stays one task: it leaves this board and appears on the new one, with its comments, attachments and history.</p>
    <button type="button" class="btn-primary mt-2 py-1" :disabled="!dest || !columnId || busy" @click="go">{{ busy ? 'Moving…' : 'Move task' }}</button>
  </details>
</template>
