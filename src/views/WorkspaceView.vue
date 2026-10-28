<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus, Lock, Search, RefreshCw, Archive, Star } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'
import { useUiStore } from '@/stores/ui'
import { loadBoardPreview, mainBoardExists } from '@/services/workspaceService'
import { subscribeUsers } from '@/services/userService'
import { roleName } from '@/utils/permissions'
import { displayOf, COLUMN_COLORS, WORKSPACE_ICONS, ROLES } from '@/utils/constants'
import WorkspaceAvatar from '@/components/WorkspaceAvatar.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import BoardCard from '@/components/BoardCard.vue'
import CreateBoardDialog from '@/components/CreateBoardDialog.vue'
import MemberManager from '@/components/MemberManager.vue'
import WorkspaceChat from '@/components/WorkspaceChat.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

// Workspace overview (Boards tab), Members tab and Settings tab. Which tab is decided by the route.
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const store = useWorkspaceStore()
const ui = useUiStore()

const wid = computed(() => route.params.wid)
const ws = computed(() => store.workspaceById(wid.value))
const tab = computed(() => route.meta.tab ?? 'boards')
const canManage = computed(() => store.roleIn(ws.value) === 'admin')
const boards = computed(() => store.boards[wid.value] ?? [])

// ----- board previews (task numbers) -----
const previews = reactive({})
async function loadPreviews(force = false) {
  for (const b of boards.value) {
    if (!force && previews[b.id]) continue
    try { previews[b.id] = await loadBoardPreview(b.id) } catch { previews[b.id] = { total: 0, done: 0, overdue: 0, columns: [], failed: true } }
  }
}
watch(() => boards.value.map((b) => b.id).join(), () => loadPreviews(), { immediate: true })
const refreshing = ref(false)
async function refresh() { refreshing.value = true; await loadPreviews(true); refreshing.value = false }

// ----- search, sort, filter -----
const search = ref('')
const sort = ref('updated')
const filter = ref('all')
const millis = (b) => b.updatedAt?.toMillis?.() ?? Date.now()
const shown = computed(() => {
  const s = search.value.trim().toLowerCase()
  let l = boards.value.filter((b) => (filter.value === 'archived' ? b.archived : !b.archived))
  if (s) l = l.filter((b) => `${b.name} ${b.description ?? ''}`.toLowerCase().includes(s))
  if (filter.value === 'starred') l = l.filter((b) => store.isStarred(b.id))
  if (filter.value === 'overdue') l = l.filter((b) => (previews[b.id]?.overdue ?? 0) > 0)
  return [...l].sort((a, b) => sort.value === 'name' ? a.name.localeCompare(b.name)
    : sort.value === 'overdue' ? (previews[b.id]?.overdue ?? 0) - (previews[a.id]?.overdue ?? 0)
    : millis(b) - millis(a))
})
const starred = computed(() => boards.value.filter((b) => !b.archived && store.isStarred(b.id)))
const open = (b) => router.push(`/b/${b.id}`)
const creating = ref(false)

// ----- members (for the header and the settings tab) -----
const users = ref({})
let unsub
onMounted(() => (unsub = subscribeUsers((u) => (users.value = u), () => {})))
onUnmounted(() => unsub?.())
const memberUsers = computed(() => Object.keys(ws.value?.members ?? {}).map((id) => users.value[id]).filter(Boolean))

// ----- settings tab -----
const form = ref({ name: '', description: '', icon: '', color: 'sage' })
watch(ws, (w) => { if (w) form.value = { name: w.name, description: w.description ?? '', icon: w.icon ?? '', color: w.color ?? 'sage' } }, { immediate: true })
const saving = ref(false)
async function saveSettings() {
  if (!form.value.name.trim()) { ui.toast('Give the workspace a name', 'error'); return }
  saving.value = true
  await store.saveWorkspace(wid.value, { ...form.value, name: form.value.name.trim(), description: form.value.description.trim() })
  saving.value = false
}
const confirmPrivacy = ref(null) // true = turning Super Private on, false = off
function askPrivacy(e) { const want = e.target.checked; e.target.checked = !!ws.value.superPrivate; confirmPrivacy.value = want } // changes only after the person confirms
async function applyPrivacy() { const on = confirmPrivacy.value; confirmPrivacy.value = null; await store.setSuperPrivate(ws.value, on) }
const confirmArchive = ref(false)
async function archive(on) { confirmArchive.value = false; await store.saveWorkspace(wid.value, { archived: on }, on ? 'Workspace archived' : 'Workspace restored') }

// Directors can put the original board ("main", also used by the PMS link) into a workspace
const mainExists = ref(true)
const addEveryone = ref(true)
const confirmAdopt = ref(false)
watch([tab, () => auth.isAdmin], async ([t, admin]) => { if (t === 'settings' && admin) mainExists.value = await mainBoardExists().catch(() => true) }, { immediate: true })
async function adopt() {
  confirmAdopt.value = false
  if (addEveryone.value) {
    const roles = Object.fromEntries(Object.values(users.value).filter((u) => !(u.id in (ws.value.members ?? {})))
      .map((u) => [u.id, [ROLES.SUPER_ADMIN, ROLES.MANAGER].includes(u.role) ? 'admin' : 'member']))
    if (Object.keys(roles).length && !(await store.addMembers(ws.value, roles))) return
  }
  if (await store.adoptMain(wid.value)) mainExists.value = true
}
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div v-if="store.loading" class="mx-auto max-w-6xl space-y-3 px-4 pt-6"><div class="skeleton h-20" /><div class="skeleton h-40" /></div>

    <div v-else-if="!ws" class="grid h-full place-items-center p-6 text-center">
      <div class="max-w-sm">
        <h1 class="text-base font-extrabold">Workspace not found</h1>
        <p class="mt-1 text-sm text-muted">It may have been removed, or you are not a member of it. Ask a workspace admin to add you.</p>
        <router-link to="/" class="btn-primary mt-4 inline-flex">Back to the dashboard</router-link>
      </div>
    </div>

    <div v-else class="mx-auto max-w-6xl px-4 pb-10 pt-5">
      <header class="flex flex-wrap items-start gap-4">
        <WorkspaceAvatar :workspace="ws" :size="56" />
        <div class="min-w-0 flex-1">
          <h1 class="truncate text-xl font-extrabold">{{ ws.name }}</h1>
          <p v-if="ws.description" class="mt-0.5 text-sm text-muted">{{ ws.description }}</p>
          <div class="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold">
            <span v-if="ws.superPrivate" class="flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-accent" title="Only the owner and the people the owner added can open this workspace. A job title does not give access."><Lock class="h-3 w-3" />Super Private</span>
            <span v-else class="flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-muted" title="Members of this workspace, and Directors, can see it"><Lock class="h-3 w-3" />Members only</span>
            <span v-if="store.isOwner(ws)" class="rounded-full bg-bg px-2.5 py-1 text-muted">You are the owner</span>
            <span class="rounded-full bg-accent-soft px-2.5 py-1 text-accent">You: {{ roleName(store.roleIn(ws)) }}</span>
            <span v-if="ws.archived" class="flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-muted"><Archive class="h-3 w-3" />Archived</span>
          </div>
        </div>
        <router-link :to="`/workspaces/${ws.id}/members`" class="flex items-center gap-2" :aria-label="`${memberUsers.length} members`">
          <span class="flex -space-x-2"><span v-for="u in memberUsers.slice(0, 5)" :key="u.id" class="rounded-full border-2 border-surface"><UserAvatar :user="u" :size="30" /></span></span>
          <span class="text-xs font-bold text-muted">{{ Object.keys(ws.members ?? {}).length }} members</span>
        </router-link>
      </header>

      <nav class="mt-5 flex gap-1 border-b border-line" aria-label="Workspace sections">
        <router-link v-for="t in [{ to: `/workspaces/${ws.id}`, label: 'Boards', key: 'boards' }, { to: `/workspaces/${ws.id}/members`, label: 'Members', key: 'members' }, ...(ws.superPrivate ? [{ to: `/workspaces/${ws.id}/chat`, label: 'Chat', key: 'chat' }] : []), { to: `/workspaces/${ws.id}/settings`, label: 'Settings', key: 'settings' }]"
          :key="t.key" :to="t.to" class="-mb-px border-b-2 px-3 py-2 text-sm font-bold" :class="tab === t.key ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'">{{ t.label }}</router-link>
      </nav>

      <!-- ===== Boards ===== -->
      <section v-if="tab === 'boards'" class="mt-5">
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative min-w-[200px] max-w-xs flex-1"><Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input v-model="search" class="input pl-9" placeholder="Search boards" aria-label="Search boards" /></div>
          <select v-model="sort" class="input w-48" aria-label="Sort boards"><option value="updated">Sort: recently updated</option><option value="name">Sort: name</option><option value="overdue">Sort: most overdue</option></select>
          <select v-model="filter" class="input w-44" aria-label="Filter boards"><option value="all">All boards</option><option value="starred">Starred</option><option value="overdue">With overdue tasks</option><option value="archived">Archived</option></select>
          <button class="btn-ghost" :disabled="refreshing" title="Reload the task numbers" @click="refresh"><RefreshCw class="h-4 w-4" :class="refreshing && 'animate-spin'" />Refresh</button>
          <button v-if="canManage" class="btn-primary ml-auto" @click="creating = true"><Plus class="h-4 w-4" />Create board</button>
        </div>

        <template v-if="starred.length && filter === 'all' && !search">
          <h2 class="mb-2 mt-6 flex items-center gap-2 text-sm font-extrabold"><Star class="h-4 w-4 text-highlight" fill="currentColor" />Starred boards</h2>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <BoardCard v-for="b in starred" :key="b.id" :board="b" :workspace-name="ws.name" :preview="previews[b.id]" starred @open="open(b)" @star="store.toggleStar(b.id)" />
          </div>
        </template>

        <h2 class="mb-2 mt-6 text-sm font-extrabold">{{ filter === 'archived' ? 'Archived boards' : 'All boards' }}</h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <BoardCard v-for="b in shown" :key="b.id" :board="b" :workspace-name="ws.name" :preview="previews[b.id]" :starred="store.isStarred(b.id)" @open="open(b)" @star="store.toggleStar(b.id)" />
          <button v-if="canManage && filter !== 'archived'" class="grid min-h-[190px] place-items-center rounded-2xl border border-dashed border-line text-sm font-bold text-muted hover:border-highlight hover:text-ink" @click="creating = true">
            <span class="flex flex-col items-center gap-1"><Plus class="h-6 w-6" />Create new board</span>
          </button>
        </div>
        <div v-if="!shown.length" class="mt-4 rounded-2xl border border-dashed border-line p-8 text-center">
          <p class="text-sm font-extrabold">{{ boards.length ? 'No boards match.' : 'This workspace has no boards yet.' }}</p>
          <p class="mt-1 text-sm text-muted">{{ boards.length ? 'Try a different search or filter.' : canManage ? 'Create the first board for this team.' : 'A workspace admin can create one.' }}</p>
          <button v-if="canManage && !boards.length" class="btn-primary mt-4" @click="creating = true"><Plus class="h-4 w-4" />Create board</button>
        </div>
      </section>

      <!-- ===== Members ===== -->
      <section v-else-if="tab === 'members'" class="mt-5"><MemberManager :workspace="ws" :can-manage="store.canManageMembers(ws)" /></section>

      <!-- ===== Chat (Super Private workspaces only) ===== -->
      <section v-else-if="tab === 'chat'" class="mt-5">
        <WorkspaceChat v-if="ws.superPrivate && ws.members?.[auth.user?.uid]" :workspace-id="ws.id" :workspace="ws" :users="users" :is-admin="store.roleIn(ws) === 'admin'" />
        <p v-else class="rounded-xl border border-line bg-surface p-4 text-sm text-muted">Chat is only available in Super Private workspaces, to the people who were added to them.</p>
      </section>

      <!-- ===== Settings ===== -->
      <section v-else class="mt-5 max-w-xl">
        <p v-if="!canManage" class="rounded-xl border border-line bg-surface p-4 text-sm text-muted">Only workspace admins can change these settings.</p>
        <template v-else>
          <form class="space-y-3 rounded-2xl border border-line bg-surface p-4" @submit.prevent="saveSettings">
            <div><label class="label" for="s-name">Name</label><input id="s-name" v-model="form.name" class="input" maxlength="80" /></div>
            <div><label class="label" for="s-desc">Description</label><textarea id="s-desc" v-model="form.description" rows="2" class="input" maxlength="300" /></div>
            <div><span class="label">Icon</span>
              <div class="flex flex-wrap gap-1.5">
                <button type="button" class="grid h-8 w-8 place-items-center rounded-lg border text-xs font-bold text-muted" :class="!form.icon ? 'border-accent ring-2 ring-accent' : 'border-line'" title="First letter of the name" @click="form.icon = ''">Aa</button>
                <button v-for="i in WORKSPACE_ICONS" :key="i" type="button" class="grid h-8 w-8 place-items-center rounded-lg border text-base" :class="form.icon === i ? 'border-accent ring-2 ring-accent' : 'border-line'" :aria-label="'Icon ' + i" @click="form.icon = i">{{ i }}</button>
              </div></div>
            <div><span class="label">Colour</span>
              <div class="flex gap-1.5"><button v-for="c in COLUMN_COLORS" :key="c.id" type="button" class="h-7 w-7 rounded-full border-2" :class="form.color === c.id ? 'border-ink' : 'border-transparent'" :style="{ background: c.hex }" :title="c.name" :aria-label="c.name" @click="form.color = c.id" /></div></div>
            <button class="btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save settings' }}</button>
          </form>

          <div v-if="store.isOwner(ws)" class="mt-4 rounded-2xl border border-line bg-surface p-4">
            <label class="flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" class="mt-0.5 accent-[var(--accent)]" :checked="!!ws.superPrivate" @change="askPrivacy($event)" />
              <span><span class="flex items-center gap-1 text-sm font-extrabold"><Lock class="h-3.5 w-3.5" />Super Private Workspace</span>
                <span class="mt-0.5 block text-sm text-muted">Only you and the people you add can open this workspace, its boards, tasks, comments and attachments. Directors, Department Managers and admins get no access from their job, and only you can add or remove members.</span></span>
            </label>
          </div>
          <p v-else-if="ws.superPrivate" class="mt-4 rounded-2xl border border-line bg-surface p-4 text-sm text-muted"><b class="text-ink">Super Private.</b> Only the owner can change this.</p>

          <div v-if="auth.isAdmin && !mainExists && !ws.superPrivate" class="mt-4 rounded-2xl border border-line bg-surface p-4">
            <h2 class="text-sm font-extrabold">Add the original Main board</h2>
            <p class="mt-1 text-sm text-muted">The Main board is where today's tasks live (and where the PMS link creates tasks). Adding it puts it in this workspace without moving or copying any task. <b class="text-ink">From then on, only members of this workspace can open it</b>, instead of people being limited to their own department.</p>
            <label class="mt-3 flex items-center gap-2 text-sm font-semibold"><input v-model="addEveryone" type="checkbox" class="accent-[var(--accent)]" />Also add everyone who has signed in (Directors and Managers as admins, others as members)</label>
            <button class="btn-ghost mt-3" @click="confirmAdopt = true">Add the Main board to this workspace</button>
          </div>

          <div class="mt-4 rounded-2xl border border-line bg-surface p-4">
            <h2 class="text-sm font-extrabold">{{ ws.archived ? 'Restore this workspace' : 'Archive this workspace' }}</h2>
            <p class="mt-1 text-sm text-muted">{{ ws.archived ? 'It will appear in the sidebar again.' : 'It disappears from the sidebar. Boards, tasks and members are kept.' }}</p>
            <button v-if="ws.archived" class="btn-ghost mt-3" @click="archive(false)">Restore workspace</button>
            <button v-else class="btn-ghost mt-3" @click="confirmArchive = true"><Archive class="h-4 w-4" />Archive workspace</button>
          </div>
        </template>
      </section>
    </div>

    <CreateBoardDialog v-if="creating" :workspace-id="wid" @close="creating = false" @created="(id) => { creating = false; router.push(`/b/${id}`) }" />
    <ConfirmDialog v-if="confirmPrivacy !== null" :title="confirmPrivacy ? 'Make this workspace Super Private?' : 'Make this workspace normal again?'"
      :message="confirmPrivacy ? 'From now on only you and the people you add can open it. Directors, Department Managers and admins who are not on the list lose access at once, and its tasks disappear from their Main Board. You can undo this at any time.' : 'Directors will be able to see this workspace again, and people assigned to its tasks can read those tasks. Its members stay as they are.'"
      :confirm-text="confirmPrivacy ? 'Make Super Private' : 'Make normal'" @cancel="confirmPrivacy = null" @confirm="applyPrivacy" />
    <ConfirmDialog v-if="confirmArchive" title="Archive this workspace?" message="It disappears from the sidebar for everyone. Nothing is deleted, and you can restore it here." confirm-text="Archive" @cancel="confirmArchive = false" @confirm="archive(true)" />
    <ConfirmDialog v-if="confirmAdopt" title="Add the Main board?" message="Tasks keep their IDs and stay where they are. Only the members of this workspace (plus Directors, and anyone assigned a task) will be able to see the board afterwards. This cannot be undone from the app." confirm-text="Add the board" @cancel="confirmAdopt = false" @confirm="adopt" />
  </div>
</template>
