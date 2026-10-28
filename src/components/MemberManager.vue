<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { UserPlus, X, Users, Lock } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'
import { subscribeUsers } from '@/services/userService'
import { WORKSPACE_ROLES } from '@/utils/permissions'
import { displayOf, deptName, ROLES } from '@/utils/constants'
import UserAvatar from './UserAvatar.vue'
import ConfirmDialog from './ConfirmDialog.vue'

// Members of a workspace are the company's existing employees (users/{uid}); nobody new is created here.
const props = defineProps({ workspace: Object, canManage: Boolean })
const auth = useAuthStore()
const store = useWorkspaceStore()

const users = ref({})
let unsub
onMounted(() => (unsub = subscribeUsers((u) => (users.value = u), () => {})))
onUnmounted(() => unsub?.())

const members = computed(() => Object.entries(props.workspace.members ?? {})
  .map(([uid, role]) => ({ uid, role, user: users.value[uid] }))
  .sort((a, b) => (a.role === 'admin' ? 0 : 1) - (b.role === 'admin' ? 0 : 1) || displayOf(a.user).localeCompare(displayOf(b.user))))
const candidates = computed(() => Object.values(users.value)
  .filter((u) => !(u.id in (props.workspace.members ?? {})))
  .sort((a, b) => displayOf(a).localeCompare(displayOf(b))))

const pick = ref('')
const pickRole = ref('member')
const search = ref('')
const shown = computed(() => {
  const s = search.value.trim().toLowerCase()
  return candidates.value.filter((u) => !s || `${displayOf(u)} ${u.email ?? ''}`.toLowerCase().includes(s))
})
async function add() {
  if (!pick.value) return
  if (await store.addMembers(props.workspace, { [pick.value]: pickRole.value })) pick.value = ''
}

const confirmAll = ref(false)
async function addAll() {
  confirmAll.value = false
  // Directors and Department Managers become admins, everyone else a member
  const roles = Object.fromEntries(candidates.value.map((u) => [u.id, [ROLES.SUPER_ADMIN, ROLES.MANAGER].includes(u.role) ? 'admin' : 'member']))
  if (Object.keys(roles).length) await store.addMembers(props.workspace, roles)
}
const remove = ref(null)
async function confirmRemove() { await store.kick(props.workspace, remove.value.uid); remove.value = null }
</script>

<template>
  <section>
    <p v-if="workspace.superPrivate" class="mb-3 flex items-start gap-2 rounded-xl border border-line bg-surface p-3 text-sm text-muted"><Lock class="mt-0.5 h-4 w-4 shrink-0 text-accent" /><span><b class="text-ink">Super Private.</b> Only the owner and the people listed here can open this workspace. {{ canManage ? 'You are the owner, so you decide who is in.' : 'Only the owner can add or remove people.' }}</span></p>
    <div v-if="canManage" class="rounded-2xl border border-line bg-surface p-4">
      <h3 class="flex items-center gap-2 text-sm font-extrabold"><UserPlus class="h-4 w-4 text-accent" />Add a member</h3>
      <p class="mt-1 text-xs text-muted">Choose from people who already have a Widebed account (they sign in with their PMS login).</p>
      <div class="mt-3 flex flex-wrap items-end gap-2">
        <div class="min-w-[180px] flex-1"><label class="label" for="m-search">Search</label><input id="m-search" v-model="search" class="input" placeholder="Name or email" /></div>
        <div class="min-w-[200px] flex-1"><label class="label" for="m-pick">Person</label>
          <select id="m-pick" v-model="pick" class="input"><option value="">Choose…</option><option v-for="u in shown" :key="u.id" :value="u.id">{{ displayOf(u) }}{{ u.email ? ` (${u.email})` : '' }}{{ u.stub ? ' (not signed in yet)' : '' }}</option></select></div>
        <div><label class="label" for="m-role">Role</label>
          <select id="m-role" v-model="pickRole" class="input w-32"><option v-for="r in WORKSPACE_ROLES" :key="r.id" :value="r.id">{{ r.name }}</option></select></div>
        <button class="btn-primary" :disabled="!pick" @click="add"><UserPlus class="h-4 w-4" />Add</button>
        <button v-if="candidates.length && !workspace.superPrivate" class="btn-ghost" @click="confirmAll = true"><Users class="h-4 w-4" />Add everyone ({{ candidates.length }})</button>
      </div>
    </div>

    <ul class="mt-4 space-y-1.5">
      <li v-for="m in members" :key="m.uid" class="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
        <UserAvatar :user="m.user" :size="34" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-bold">{{ displayOf(m.user) }}<span v-if="m.uid === auth.user.uid" class="ml-1.5 text-xs font-semibold text-muted">(you)</span><span v-if="m.uid === workspace.createdBy" class="ml-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-accent">Owner</span></p>
          <p class="truncate text-xs text-muted">{{ m.user?.email || '—' }} · {{ deptName(m.user?.departmentId) }}</p>
        </div>
        <select v-if="canManage && m.uid !== workspace.createdBy" :value="m.role" class="input w-32 py-1" :aria-label="`Role of ${displayOf(m.user)}`" @change="store.changeRole(workspace, m.uid, $event.target.value)">
          <option v-for="r in WORKSPACE_ROLES" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
        <span v-else class="rounded-md bg-bg px-2 py-0.5 text-xs font-bold capitalize text-muted">{{ m.role }}</span>
        <button v-if="canManage && m.uid !== workspace.createdBy" class="rounded p-1 text-muted hover:bg-bg hover:text-red-600" :aria-label="`Remove ${displayOf(m.user)}`" @click="remove = m"><X class="h-4 w-4" /></button>
      </li>
      <li v-if="!members.length" class="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">No members yet.</li>
    </ul>

    <ConfirmDialog v-if="remove" title="Remove this member?" :message="`${displayOf(remove.user)} will lose access to this workspace and all of its boards. Their tasks and comments stay.`" confirm-text="Remove" @cancel="remove = null" @confirm="confirmRemove" />
    <ConfirmDialog v-if="confirmAll" title="Add everyone?" :message="`${candidates.length} people will be added: Directors and Department Managers as admins, everyone else as members. You can change any role afterwards.`" confirm-text="Add everyone" @cancel="confirmAll = false" @confirm="addAll" />
  </section>
</template>
