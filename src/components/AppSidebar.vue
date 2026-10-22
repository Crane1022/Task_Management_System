<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { LayoutDashboard, Columns3, ListChecks, UserCheck, PanelLeftClose, PanelLeftOpen, LogOut, Leaf, Palette, Users } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { deptName } from '@/utils/constants'

const ui = useUiStore()
const auth = useAuthStore()
const router = useRouter()

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/board', label: 'Kanban Board', icon: Columns3 },
  { to: '/list', label: 'List', icon: ListChecks },
  { to: '/my-tasks', label: 'My Tasks', icon: UserCheck },
]
const accountLinks = [{ to: '/settings/appearance', label: 'Appearance & Theme', icon: Palette }]
const adminLinks = [{ to: '/staff', label: 'Staff', icon: Users }] // Super Admin only
const roleLabel = { super_admin: 'Super Admin', dept_manager: 'Department Manager', employee: 'Employee' }
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

    <nav class="flex-1 space-y-1 px-2 py-2">
      <router-link
        v-for="l in links" :key="l.to" :to="l.to" exact-active-class="bg-accent-soft text-accent"
        class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-bg"
        :title="l.label" @click="ui.mobileNav = false"
      >
        <component :is="l.icon" class="h-[18px] w-[18px] shrink-0" />
        <span :class="ui.collapsed && 'md:hidden'">{{ l.label }}</span>
      </router-link>
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
        <div class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{{ initials }}</div>
        <div class="min-w-0 flex-1" :class="ui.collapsed && 'md:hidden'">
          <p class="truncate text-sm font-bold">{{ auth.profile?.name }}</p>
          <p class="truncate text-xs text-muted">{{ deptName(auth.profile?.departmentId) }} · {{ roleLabel[auth.profile?.role] }}</p>
        </div>
        <button :class="ui.collapsed && 'md:hidden'" class="text-muted hover:text-ink" title="Sign out" aria-label="Sign out" @click="signOut">
          <LogOut class="h-4 w-4" />
        </button>
      </div>
    </div>
  </aside>
</template>
