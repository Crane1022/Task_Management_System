<script setup>
// Phone only (25 Nov 2026): the main pages are one thumb-tap away at the bottom of the screen, and "More" opens the
// full menu (workspaces, Staff, account). On task pages a round + button above the bar makes a new task.
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { LayoutDashboard, Columns3, ListChecks, UserCheck, Menu, Plus } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'
import { useBoardStore } from '@/stores/board'

const ui = useUiStore()
const board = useBoardStore()
const route = useRoute()

const items = [
  { to: '/', label: 'Home', icon: LayoutDashboard, names: ['dashboard'] },
  { to: '/board', label: 'Board', icon: Columns3, names: ['board', 'board-by-id'] },
  { to: '/list', label: 'List', icon: ListChecks, names: ['list', 'calendar'] },
  { to: '/my-tasks', label: 'My tasks', icon: UserCheck, names: ['my-tasks'] },
]
const onMain = computed(() => items.some((i) => i.names.includes(route.name)))
const showAdd = computed(() => route.meta.tasks && board.canEdit && !board.loading)
</script>

<template>
  <div class="sm:hidden">
    <button v-if="showAdd" class="fab fixed right-4 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-accent text-on-primary shadow-xl active:scale-95" aria-label="New task" @click="ui.requestNewTask()">
      <Plus class="h-7 w-7" />
    </button>
    <nav class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface px-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-4px_16px_rgb(30_60_45/0.06)]" aria-label="Main">
      <router-link v-for="i in items" :key="i.to" :to="i.to" class="group flex min-h-[52px] flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold"
        :class="i.names.includes(route.name) ? 'text-accent' : 'text-muted'" :aria-current="i.names.includes(route.name) ? 'page' : null">
        <span class="grid h-[30px] w-[52px] place-items-center rounded-full transition-colors" :class="i.names.includes(route.name) && 'bg-accent-soft'"><component :is="i.icon" class="h-[22px] w-[22px]" /></span>
        {{ i.label }}
      </router-link>
      <button class="flex min-h-[52px] flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold" :class="!onMain ? 'text-accent' : 'text-muted'" aria-label="More: workspaces, staff and account" @click="ui.mobileNav = true">
        <span class="grid h-[30px] w-[52px] place-items-center rounded-full" :class="!onMain && 'bg-accent-soft'"><Menu class="h-[22px] w-[22px]" /></span>
        More
      </button>
    </nav>
  </div>
</template>

<style scoped>
/* sits just above the bar, and above the phone's home indicator */
.fab { bottom: calc(76px + env(safe-area-inset-bottom)); }
</style>
