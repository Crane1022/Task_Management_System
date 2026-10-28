<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { LayoutDashboard, Columns3, ListChecks, UserCheck, PanelLeftClose, PanelLeftOpen, LogOut, Leaf, Palette, Users, ChevronDown, ChevronRight, Plus, UserRound, PawPrint, Lock } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'
import WorkspaceAvatar from '@/components/WorkspaceAvatar.vue'
import CreateWorkspaceDialog from '@/components/CreateWorkspaceDialog.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { deptName, displayOf } from '@/utils/constants'

const ui = useUiStore()
const auth = useAuthStore()
const router = useRouter()

// ----- workspaces: each one expands to Boards, Members and Settings -----
const wsStore = useWorkspaceStore()
const myWorkspaces = computed(() => wsStore.workspaces.filter((w) => !w.archived))
const openIds = ref(JSON.parse(localStorage.getItem('wb-ws-open') || '[]'))
const isOpen = (id) => openIds.value.includes(id)
function toggleWs(id) {
  openIds.value = isOpen(id) ? openIds.value.filter((x) => x !== id) : [...openIds.value, id]
  localStorage.setItem('wb-ws-open', JSON.stringify(openIds.value))
}
const checking = ref(false)
async function checkOld() {
  checking.value = true
  const r = await wsStore.backfillOldWorkspaces(true)
  checking.value = false
  ui.toast(r.ok ? (r.fixed ? `Updated ${r.fixed} older workspace${r.fixed === 1 ? '' : 's'}. They will appear in a moment.` : 'Nothing to update. If the list is still empty, no workspace is shared with you yet, or the latest firestore.rules are not published.') : r.message, r.ok ? 'success' : 'error')
}
const creatingWs = ref(false)
function wsCreated(id) {
  creatingWs.value = false
  if (!isOpen(id)) toggleWs(id)
  router.push(`/workspaces/${id}`)
}

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/board', label: 'Kanban Board', icon: Columns3 },
  { to: '/list', label: 'List', icon: ListChecks },
  { to: '/my-tasks', label: 'My Tasks', icon: UserCheck },
]
const accountLinks = [
  { to: '/settings/profile', label: 'Profile & settings', icon: UserRound },
  { to: '/settings/appearance', label: 'Appearance & Theme', icon: Palette },
  { to: '/settings/companion', label: 'My companion', icon: PawPrint },
]
const adminLinks = [{ to: '/staff', label: 'Staff', icon: Users }] // Director (super_admin) only
const roleLabel = { super_admin: 'Director', dept_manager: 'Department Manager', employee: 'Employee' }
const initials = computed(() => (auth.profile?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase())

async function signOut() { await auth.logout(); router.push('/login') }
</script>

<template>
  <div v-if="ui.mobileNav" class="fixed inset-0 z-30 bg-black/40 md:hidden" @click="ui.mobileNav = false" />
  <aside
    class="fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-surface transition-[width,transform] md:static md:translate-x-0"
    :class="[ui.mobileNav ? 'translate-x-0' : '-translate-x-full', ui.collapsed ? 'w-60 md:w-[68px]' : 'w-60']"
  >
    <div class="flex h-14 items-center gap-2 px-4">
      <div class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-sm font-extrabold text-on-primary"><Leaf class="h-[18px] w-[18px]" /></div>
      <span v-if="!ui.collapsed" class="text-sm font-extrabold">Widebed Tasks</span>
      <span v-else class="md:hidden text-sm font-extrabold">Widebed Tasks</span>
    </div>

    <nav class="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 py-2">
      <router-link
        v-for="l in links" :key="l.to" :to="l.to" exact-active-class="bg-accent-soft text-accent"
        class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-bg"
        :title="l.label" @click="ui.mobileNav = false"
      >
        <component :is="l.icon" class="h-[18px] w-[18px] shrink-0" />
        <span :class="ui.collapsed && 'md:hidden'">{{ l.label }}</span>
      </router-link>
      <div class="flex items-center justify-between px-3 pb-1 pt-4" :class="ui.collapsed && 'md:hidden'">
        <p class="text-[11px] font-bold uppercase tracking-wide text-muted">Workspaces</p>
        <button v-if="wsStore.canCreateWorkspace" class="rounded p-0.5 text-muted hover:bg-bg hover:text-accent" title="Create a workspace" aria-label="Create a workspace" @click="creatingWs = true; ui.mobileNav = false"><Plus class="h-4 w-4" /></button>
      </div>
      <div v-for="w in myWorkspaces" :key="w.id">
        <div class="flex items-center">
          <router-link :to="`/workspaces/${w.id}`" exact-active-class="bg-accent-soft text-accent" class="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:bg-bg" :title="w.name" @click="ui.mobileNav = false">
            <WorkspaceAvatar :workspace="w" :size="22" />
            <span class="truncate" :class="ui.collapsed && 'md:hidden'">{{ w.name }}</span>
            <Lock v-if="w.superPrivate" class="h-3 w-3 shrink-0" :class="ui.collapsed && 'md:hidden'" title="Super Private" aria-label="Super Private" />
          </router-link>
          <button class="rounded p-1 text-muted hover:bg-bg" :class="ui.collapsed && 'md:hidden'" :aria-expanded="isOpen(w.id)" :aria-label="`${isOpen(w.id) ? 'Collapse' : 'Expand'} ${w.name}`" @click="toggleWs(w.id)">
            <component :is="isOpen(w.id) ? ChevronDown : ChevronRight" class="h-4 w-4" />
          </button>
        </div>
        <div v-if="isOpen(w.id)" class="reveal ml-[22px] pt-1 space-y-0.5 border-l border-line pl-2" :class="ui.collapsed && 'md:hidden'">
          <router-link v-for="s in [{ p: '', l: 'Boards' }, { p: '/members', l: 'Members' }, { p: '/settings', l: 'Settings' }]" :key="s.l" :to="`/workspaces/${w.id}${s.p}`"
            exact-active-class="bg-accent-soft text-accent" class="block rounded-md px-2.5 py-1 text-[13px] font-semibold text-muted hover:bg-bg" @click="ui.mobileNav = false">{{ s.l }}</router-link>
        </div>
      </div>
      <p v-if="!myWorkspaces.length && !wsStore.loading" class="px-3 py-1 text-xs text-muted" :class="ui.collapsed && 'md:hidden'">{{ wsStore.canCreateWorkspace ? 'No workspaces yet. Press + to create one.' : 'You are not in a workspace yet.' }}</p>
      <div v-if="auth.isAdmin && !wsStore.loading && !myWorkspaces.length" class="mx-3 mb-1 rounded-lg bg-bg p-2 text-xs text-muted" :class="ui.collapsed && 'md:hidden'">
        <p v-if="wsStore.error" class="font-semibold text-red-600" role="alert">Could not load workspaces: {{ wsStore.error }}</p>
        <p>Workspaces made before Super Private existed need a one-time update before every Director can see them.</p>
        <button type="button" class="mt-1.5 font-bold text-accent hover:underline" :disabled="checking" @click="checkOld">{{ checking ? 'Checking…' : 'Find older workspaces' }}</button>
      </div>
      <template v-if="auth.isAdmin">
        <p class="px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wide text-muted" :class="ui.collapsed && 'md:hidden'">Admin</p>
        <router-link
          v-for="l in adminLinks" :key="l.to" :to="l.to" exact-active-class="bg-accent-soft text-accent"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-bg"
          :title="l.label" @click="ui.mobileNav = false"
        >
          <component :is="l.icon" class="h-[18px] w-[18px] shrink-0" />
          <span :class="ui.collapsed && 'md:hidden'">{{ l.label }}</span>
        </router-link>
      </template>
      <p class="px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wide text-muted" :class="ui.collapsed && 'md:hidden'">Account</p>
      <router-link
        v-for="l in accountLinks" :key="l.to" :to="l.to" exact-active-class="bg-accent-soft text-accent"
        class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-bg"
        :title="l.label" @click="ui.mobileNav = false"
      >
        <component :is="l.icon" class="h-[18px] w-[18px] shrink-0" />
        <span :class="ui.collapsed && 'md:hidden'">{{ l.label }}</span>
      </router-link>
    </nav>

    <div class="border-t border-line p-2">
      <button class="hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-bg md:flex" @click="ui.toggleCollapsed">
        <component :is="ui.collapsed ? PanelLeftOpen : PanelLeftClose" class="h-[18px] w-[18px] shrink-0" />
        <span v-if="!ui.collapsed">Collapse</span>
      </button>
      <div class="mt-1 flex items-center gap-3 rounded-lg px-2 py-2">
        <UserAvatar :user="auth.profile" :size="36" />
        <div class="min-w-0 flex-1" :class="ui.collapsed && 'md:hidden'">
          <p class="truncate text-sm font-bold">{{ displayOf(auth.profile) }}</p>
          <p class="truncate text-xs text-muted">{{ deptName(auth.profile?.departmentId) }} · {{ roleLabel[auth.profile?.role] }}</p>
        </div>
        <button :class="ui.collapsed && 'md:hidden'" class="text-muted hover:text-ink" title="Sign out" aria-label="Sign out" @click="signOut">
          <LogOut class="h-4 w-4" />
        </button>
      </div>
    </div>
    <CreateWorkspaceDialog v-if="creatingWs" @close="creatingWs = false" @created="wsCreated" />
  </aside>
</template>
