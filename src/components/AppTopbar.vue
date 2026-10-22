<script setup>
import { useRoute } from 'vue-router'
import { Search, Plus, Sun, Moon, Menu } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'
import { useBoardStore } from '@/stores/board'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { DEPARTMENTS } from '@/utils/constants'

const ui = useUiStore()
const board = useBoardStore()
const auth = useAuthStore()
const theme = useThemeStore()
const route = useRoute()
</script>

<template>
  <header class="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
    <button class="text-muted md:hidden" aria-label="Open menu" @click="ui.mobileNav = true"><Menu class="h-5 w-5" /></button>

    <div v-if="route.meta.tasks" class="relative max-w-md flex-1">
      <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input v-model="board.filters.search" class="input pl-9" placeholder="Search tasks by title or description" aria-label="Search tasks" />
    </div>

    <span v-if="!route.meta.tasks" class="flex-1" />
    <select v-if="auth.isAdmin && route.meta.tasks" v-model="board.filters.department" class="input hidden w-44 sm:block" aria-label="Department">
      <option value="">All departments</option>
      <option v-for="d in DEPARTMENTS" :key="d.id" :value="d.id">{{ d.name }}</option>
    </select>

    <button class="btn-ghost px-2.5" :title="ui.dark ? 'Light mode' : 'Dark mode'" :aria-label="ui.dark ? 'Switch to light mode' : 'Switch to dark mode'" @click="theme.toggleDark()">
      <component :is="ui.dark ? Sun : Moon" class="h-4 w-4" />
    </button>
    <button v-if="route.meta.tasks" class="btn-primary" @click="ui.requestNewTask()">
      <Plus class="h-4 w-4" /><span class="hidden sm:inline">New task</span>
    </button>
  </header>
</template>
