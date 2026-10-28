<script setup>
import { Search, Plus } from 'lucide-vue-next'
import { useBoardStore } from '@/stores/board'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { DEPARTMENTS } from '@/utils/constants'

// The task controls of a page (search, department, New task). They used to sit in the top bar; the top bar is now the same on
// every page (dark mode and profile only), so these live at the top of the pages that show tasks.
const board = useBoardStore()
const auth = useAuthStore()
const ui = useUiStore()
</script>

<template>
  <div class="ml-auto flex flex-wrap items-center gap-2">
    <div class="relative w-56 max-w-full">
      <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input v-model="board.filters.search" class="input py-1.5 pl-9" placeholder="Search tasks" aria-label="Search tasks by title or description" />
    </div>
    <select v-if="auth.isAdmin" v-model="board.filters.department" class="input hidden w-40 py-1.5 sm:block" aria-label="Department">
      <option value="">All departments</option>
      <option v-for="d in DEPARTMENTS" :key="d.id" :value="d.id">{{ d.name }}</option>
    </select>
    <button v-if="board.canEdit" class="btn-primary" @click="ui.requestNewTask()"><Plus class="h-4 w-4" /><span class="hidden sm:inline">New task</span><span class="sm:hidden">New</span></button>
  </div>
</template>
