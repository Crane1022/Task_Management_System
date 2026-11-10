<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'

// Chooses which board the Kanban, List, My Tasks and Dashboard pages show.
// On the Kanban page the choice goes into the address: the Main board is /board, any other board is /b/<id>.
// So "Kanban Board" in the sidebar always comes back to the Main board, and a refresh keeps the board you picked.
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const ws = useWorkspaceStore()
const groups = computed(() => ws.workspaces
  .map((w) => ({ ws: w, boards: (ws.boards[w.id] ?? []).filter((b) => !b.archived) }))
  .filter((g) => g.boards.length))
function choose(id) {
  if (route.name === 'board' || route.name === 'board-by-id') router.push(id === 'main' ? '/board' : `/b/${id}`)
  else ui.setActiveBoard(id)
}
const known = computed(() => ui.activeBoardId === 'main' || ws.boardById(ui.activeBoardId))
</script>

<template>
  <select class="input w-52 py-1" :value="ui.activeBoardId" aria-label="Board" @change="choose($event.target.value)">
    <option v-if="!ws.boardById('main')" value="main">Main board (all my workspaces)</option>
    <option v-if="!known" :value="ui.activeBoardId">This board</option>
    <optgroup v-for="g in groups" :key="g.ws.id" :label="g.ws.name">
      <option v-for="b in g.boards" :key="b.id" :value="b.id">{{ b.name }}</option>
    </optgroup>
  </select>
</template>
