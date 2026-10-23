<script setup>
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'

// Chooses which board the Kanban, List, My Tasks and Dashboard pages show.
const ui = useUiStore()
const ws = useWorkspaceStore()
const groups = computed(() => ws.workspaces
  .map((w) => ({ ws: w, boards: (ws.boards[w.id] ?? []).filter((b) => !b.archived) }))
  .filter((g) => g.boards.length))
const known = computed(() => ui.activeBoardId === 'main' || ws.boardById(ui.activeBoardId))
</script>

<template>
  <select class="input w-52 py-1" :value="ui.activeBoardId" aria-label="Board" @change="ui.setActiveBoard($event.target.value)">
    <option v-if="!ws.boardById('main')" value="main">Main board</option>
    <option v-if="!known" :value="ui.activeBoardId">This board</option>
    <optgroup v-for="g in groups" :key="g.ws.id" :label="g.ws.name">
      <option v-for="b in g.boards" :key="b.id" :value="b.id">{{ b.name }}</option>
    </optgroup>
  </select>
</template>
