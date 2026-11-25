<script setup>
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, UserPlus, MessageSquare, AtSign, ArrowRightLeft, CheckCircle2, Users, UserMinus, Clock, AlertTriangle, CheckCheck, Trash2, X } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'
import { formatDateTime } from '@/utils/dates'
import PushToggle from '@/components/PushToggle.vue'
import PawLoader from '@/components/PawLoader.vue'

// The bell in the top bar: unread count, the list, mark as read, and a click that opens the task or workspace.
const auth = useAuthStore()
const store = useNotificationStore()
const router = useRouter()
const open = ref(false)

watch(() => auth.user?.uid, (uid) => (uid ? store.start(uid) : store.stop()), { immediate: true })

const ICONS = {
  assigned: UserPlus, comment: MessageSquare, mention: AtSign, moved: ArrowRightLeft, completed: CheckCircle2,
  workspace_added: Users, workspace_removed: UserMinus, deadline_soon: Clock, deadline_overdue: AlertTriangle,
}
const badge = computed(() => (store.unread > 9 ? '9+' : String(store.unread)))

async function go(n) {
  open.value = false
  store.read(n)
  if (n.taskId) router.push({ path: `/b/${n.boardId || 'main'}`, query: { task: n.taskId } })
  else if (n.type === 'mention' && n.workspaceId) router.push(`/workspaces/${n.workspaceId}/chat`) // tagged in the team chat
  else if (n.workspaceId && n.type !== 'workspace_removed') router.push(`/workspaces/${n.workspaceId}`)
}
</script>

<template>
  <div class="relative">
    <button class="btn-ghost relative px-2.5" :aria-label="store.unread ? `Notifications, ${store.unread} unread` : 'Notifications'" :aria-expanded="open" @click="open = !open">
      <Bell class="h-4 w-4" />
      <span v-if="store.unread" class="absolute -right-1 -top-1 grid min-w-[1.1rem] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white">{{ badge }}</span>
    </button>
    <template v-if="open">
      <div class="fixed inset-0 z-20" @click="open = false" />
      <!-- phone (25 Nov 2026): the panel spans the screen under the top bar; it used to line up with the bell's right edge and ran off the left side -->
      <div class="fixed inset-x-2 top-[3.75rem] z-30 rounded-xl border border-line bg-surface shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(24rem,calc(100vw-2rem))]" role="dialog" aria-label="Notifications">
        <div class="flex items-center gap-2 border-b border-line px-3 py-2">
          <p class="flex-1 text-sm font-extrabold">Notifications</p>
          <button v-if="store.unread" class="btn-ghost px-2 py-1 text-xs" @click="store.readAll()"><CheckCheck class="h-3.5 w-3.5" />Mark all read</button>
          <button v-if="store.items.length" class="btn-ghost px-2 py-1 text-xs" title="Remove all" @click="store.clear()"><Trash2 class="h-3.5 w-3.5" /><span class="sr-only">Remove all notifications</span></button>
        </div>
        <p v-if="store.failed" class="px-3 py-6 text-center text-sm font-semibold text-red-600" role="alert">Notifications could not be loaded.</p>
        <PawLoader v-else-if="store.loading" text="Loading notifications…" />
        <p v-else-if="!store.items.length" class="px-3 py-8 text-center text-sm text-muted">You are all caught up.</p>
        <ul v-else class="max-h-[min(26rem,calc(100dvh-16rem))] divide-y divide-line overflow-auto overscroll-contain sm:max-h-[26rem]">
          <li v-for="n in store.items" :key="n.id" class="group relative">
            <button class="flex w-full items-start gap-3 px-3 py-2.5 pr-9 text-left hover:bg-bg" :class="n.read ? '' : 'bg-accent-soft/40'" @click="go(n)">
              <span class="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><component :is="ICONS[n.type] ?? Bell" class="h-3.5 w-3.5" /></span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm" :class="n.read ? 'font-medium' : 'font-bold'">{{ n.title }}</span>
                <span v-if="n.body" class="block truncate text-xs text-muted">{{ n.body }}</span>
                <span class="block text-[11px] text-muted">{{ formatDateTime(n.createdAt) }}</span>
              </span>
              <span v-if="!n.read" class="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />
            </button>
            <button class="absolute right-2 top-2 rounded p-1 text-muted opacity-0 hover:text-red-600 focus:opacity-100 group-hover:opacity-100" aria-label="Remove this notification" @click.stop="store.remove(n)"><X class="h-3.5 w-3.5" /></button>
          </li>
        </ul>
        <PushToggle />
      </div>
    </template>
  </div>
</template>
