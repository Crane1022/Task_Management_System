<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Sun, Moon, Search, Plus, UserRound, Palette, LogOut, PawPrint, Leaf, X, Compass } from 'lucide-vue-next'
import UserAvatar from '@/components/UserAvatar.vue'
import NotificationBell from '@/components/NotificationBell.vue'
import SearchPanel from '@/components/SearchPanel.vue'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useBoardStore } from '@/stores/board'
import { useWorkspaceStore } from '@/stores/workspace'
import { displayOf, deptName } from '@/utils/constants'

const ui = useUiStore()
const auth = useAuthStore()
const theme = useThemeStore()
const router = useRouter()
const route = useRoute()
const board = useBoardStore() // the task pages (board, list, my tasks) share one search box and one New task button, here in the bar
const wsStore = useWorkspaceStore()
const menu = ref(false)
const roleLabel = { super_admin: 'Director', dept_manager: 'Department Manager', employee: 'Employee' }
const signingOut = ref(false)
async function signOut() {
  signingOut.value = true
  try { await ui.track(auth.logout()); menu.value = false; router.push('/login') } finally { signingOut.value = false }
}

// On a phone (25 Nov 2026) the bar shows the page's name instead of the search box. The search button opens the box
// over the bar; it stays open while there is something typed in it.
const TITLES = {
  dashboard: 'Dashboard', board: 'Kanban board', 'board-by-id': 'Kanban board', 'my-tasks': 'My tasks', list: 'List', calendar: 'Calendar',
  staff: 'Staff', festive: 'Festive events', profile: 'Profile', companion: 'My companion', appearance: 'Appearance',
}
const title = computed(() => {
  if (route.params.wid) return wsStore.workspaces.find((w) => w.id === route.params.wid)?.name ?? 'Workspace'
  if (route.name === 'board-by-id' && board.boardName) return board.boardName
  return TITLES[route.name] ?? 'Widebed Tasks'
})
const searchOpen = ref(false)
const searchBox = ref(null)
async function openSearch() { searchOpen.value = true; await nextTick(); searchBox.value?.focus() }
function closeSearch() { board.filters.search = ''; searchOpen.value = false }
watch(() => route.fullPath, () => { if (!board.filters.search) searchOpen.value = false; resultsOpen.value = false })
// the results list under the box (tasks, comments, files) shows while the box has focus and something is typed
const resultsOpen = ref(false)
function picked() { resultsOpen.value = false; board.filters.search = ''; searchOpen.value = false }
</script>

<template>
  <header class="relative flex h-14 shrink-0 items-center gap-1 border-b border-line bg-surface px-3 sm:gap-3 sm:px-4">
    <!-- phone: logo and page name (the menu lives in the bottom bar's "More") -->
    <div class="flex min-w-0 flex-1 items-center gap-2.5 sm:hidden">
      <div class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-on-primary"><Leaf class="h-[18px] w-[18px]" /></div>
      <span class="truncate text-[17px] font-extrabold">{{ title }}</span>
    </div>
    <button v-if="route.meta.tasks" class="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink hover:bg-bg sm:hidden" aria-label="Search tasks" @click="openSearch"><Search class="h-5 w-5" /></button>

    <template v-if="route.meta.tasks">
      <div class="relative w-full max-w-xs" :class="searchOpen ? 'absolute inset-x-2 top-1/2 z-10 max-w-none -translate-y-1/2 sm:static sm:translate-y-0' : 'hidden sm:block'">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input ref="searchBox" v-model="board.filters.search" type="search" class="input py-1.5 pl-9 pr-10 sm:pr-3" placeholder="Search tasks, comments, files" aria-label="Search tasks, comments and attached files" @focus="resultsOpen = true" @input="resultsOpen = true" @blur="resultsOpen = false" @keydown.esc="resultsOpen ? (resultsOpen = false) : closeSearch()" />
        <SearchPanel v-if="resultsOpen && board.filters.search.trim()" :query="board.filters.search" @picked="picked" />
        <button v-if="searchOpen" class="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-muted sm:hidden" aria-label="Close search" @click="closeSearch"><X class="h-5 w-5" /></button>
      </div>
      <button v-if="board.canEdit" class="btn-primary hidden shrink-0 sm:inline-flex" @click="ui.requestNewTask()"><Plus class="h-4 w-4" />New task</button>
    </template>
    <span class="hidden flex-1 sm:block" />

    <!-- far right, the same on every page: notifications, dark mode, then the profile -->
    <NotificationBell />
    <button class="btn-ghost hidden px-2.5 sm:inline-flex" :title="ui.dark ? 'Light mode' : 'Dark mode'" :aria-label="ui.dark ? 'Switch to light mode' : 'Switch to dark mode'" @click="theme.toggleDark()">
      <component :is="ui.dark ? Sun : Moon" class="h-4 w-4" />
    </button>

    <div class="relative">
      <button class="grid h-11 w-11 place-items-center rounded-full ring-offset-2 ring-offset-surface hover:ring-2 hover:ring-highlight" aria-label="Account menu" :aria-expanded="menu" @click="menu = !menu"><UserAvatar :user="auth.profile" :size="34" /></button>
      <template v-if="menu">
        <div class="fixed inset-0 z-20" @click="menu = false" />
        <div class="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-line bg-surface p-2 shadow-xl" role="menu">
          <div class="flex items-center gap-3 px-2 py-2">
            <UserAvatar :user="auth.profile" :size="40" />
            <div class="min-w-0"><p class="truncate text-sm font-bold">{{ displayOf(auth.profile) }}</p><p class="truncate text-xs text-muted">{{ deptName(auth.profile?.departmentId) }} · {{ roleLabel[auth.profile?.role] }}</p></div>
          </div>
          <router-link to="/settings/profile" class="flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold hover:bg-bg sm:min-h-0 sm:py-2" @click="menu = false"><UserRound class="h-4 w-4" />Profile and settings</router-link>
          <router-link to="/settings/appearance" class="flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold hover:bg-bg sm:min-h-0 sm:py-2" @click="menu = false"><Palette class="h-4 w-4" />Appearance and theme</router-link>
          <router-link to="/settings/companion" class="flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-semibold hover:bg-bg sm:min-h-0 sm:py-2" @click="menu = false"><PawPrint class="h-4 w-4" />My companion</router-link>
          <!-- 26 Nov 2026: the welcome tour again, any time -->
          <button type="button" role="menuitem" class="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 text-sm font-semibold hover:bg-bg sm:min-h-0 sm:py-2" @click="menu = false; ui.tourOpen = true"><Compass class="h-4 w-4" />Show the guide tour</button>
          <!-- phone: dark mode lives here, so the bar has room for the page name -->
          <button class="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 text-sm font-semibold hover:bg-bg sm:hidden" @click="theme.toggleDark(); menu = false"><component :is="ui.dark ? Sun : Moon" class="h-4 w-4" />{{ ui.dark ? 'Light mode' : 'Dark mode' }}</button>
          <button v-busy="signingOut" class="btn flex min-h-[44px] w-full justify-start gap-2 rounded-lg px-2 text-sm font-semibold text-red-600 hover:bg-bg sm:min-h-0 sm:py-2" @click="signOut"><LogOut class="h-4 w-4" />{{ signingOut ? 'Signing out…' : 'Sign out' }}</button>
        </div>
      </template>
    </div>
  </header>
</template>
