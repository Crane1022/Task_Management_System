<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Sun, Moon, Menu, Search, Plus, UserRound, Palette, LogOut, PawPrint } from 'lucide-vue-next'
import UserAvatar from '@/components/UserAvatar.vue'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useBoardStore } from '@/stores/board'
import { displayOf, deptName } from '@/utils/constants'

const ui = useUiStore()
const auth = useAuthStore()
const theme = useThemeStore()
const router = useRouter()
const route = useRoute()
const board = useBoardStore() // the task pages (board, list, my tasks) share one search box and one New task button, here in the bar
const menu = ref(false)
const roleLabel = { super_admin: 'Director', dept_manager: 'Department Manager', employee: 'Employee' }
async function signOut() { menu.value = false; await auth.logout(); router.push('/login') }
</script>

<template>
  <header class="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
    <button class="text-muted md:hidden" aria-label="Open menu" @click="ui.mobileNav = true"><Menu class="h-5 w-5" /></button>
    <template v-if="route.meta.tasks">
      <div class="relative w-full max-w-xs">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input v-model="board.filters.search" type="search" class="input py-1.5 pl-9" placeholder="Search tasks" aria-label="Search tasks by title or description" />
      </div>
      <button v-if="board.canEdit" class="btn-primary shrink-0" @click="ui.requestNewTask()"><Plus class="h-4 w-4" /><span class="hidden sm:inline">New task</span><span class="sr-only sm:hidden">New task</span></button>
    </template>
    <span class="flex-1" />

    <!-- far right, the same on every page: dark mode, then the profile -->
    <button class="btn-ghost px-2.5" :title="ui.dark ? 'Light mode' : 'Dark mode'" :aria-label="ui.dark ? 'Switch to light mode' : 'Switch to dark mode'" @click="theme.toggleDark()">
      <component :is="ui.dark ? Sun : Moon" class="h-4 w-4" />
    </button>

    <div class="relative">
      <button class="rounded-full ring-offset-2 ring-offset-surface hover:ring-2 hover:ring-highlight" aria-label="Account menu" :aria-expanded="menu" @click="menu = !menu"><UserAvatar :user="auth.profile" :size="34" /></button>
      <template v-if="menu">
        <div class="fixed inset-0 z-20" @click="menu = false" />
        <div class="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-line bg-surface p-2 shadow-xl" role="menu">
          <div class="flex items-center gap-3 px-2 py-2">
            <UserAvatar :user="auth.profile" :size="40" />
            <div class="min-w-0"><p class="truncate text-sm font-bold">{{ displayOf(auth.profile) }}</p><p class="truncate text-xs text-muted">{{ deptName(auth.profile?.departmentId) }} · {{ roleLabel[auth.profile?.role] }}</p></div>
          </div>
          <router-link to="/settings/profile" class="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-bg" @click="menu = false"><UserRound class="h-4 w-4" />Profile and settings</router-link>
          <router-link to="/settings/appearance" class="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-bg" @click="menu = false"><Palette class="h-4 w-4" />Appearance and theme</router-link>
          <router-link to="/settings/companion" class="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-bg" @click="menu = false"><PawPrint class="h-4 w-4" />My companion</router-link>
          <button class="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-red-600 hover:bg-bg" @click="signOut"><LogOut class="h-4 w-4" />Sign out</button>
        </div>
      </template>
    </div>
  </header>
</template>
