<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Users, MessageCircle, Plus, Settings2, Hash } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { subscribeChats, createChat, updateChat, deleteConversation } from '@/services/workspaceService'
import { displayOf } from '@/utils/constants'
import { dmId, chatTitle, sortChats, groupProblem } from '@/utils/chats'
import WorkspaceChat from './WorkspaceChat.vue'
import UserAvatar from './UserAvatar.vue'
import ConfirmDialog from './ConfirmDialog.vue'

// The chat area of a Super Private workspace: the Everyone channel, group chats anyone can make, and direct messages
// between two members. Everything is private to the people in it (firestore.rules).
const props = defineProps({ workspace: Object, users: { type: Object, default: () => ({}) }, isAdmin: Boolean })
const auth = useAuthStore()
const ui = useUiStore()
const me = computed(() => auth.user?.uid)
const wid = computed(() => props.workspace.id)

const chats = ref([])
const loadFailed = ref(false)
let unsub
onMounted(() => { unsub = subscribeChats(wid.value, me.value, (c) => (chats.value = c), () => (loadFailed.value = true)) })
onUnmounted(() => unsub?.())

const nameOf = (id) => (props.users[id] ? displayOf(props.users[id]) : '')
const members = computed(() => Object.keys(props.workspace.members ?? {}).filter((id) => id !== me.value && props.users[id]).map((id) => ({ ...props.users[id], id })))
const groups = computed(() => sortChats(chats.value.filter((c) => c.type === 'group'), me.value, nameOf))
const dms = computed(() => sortChats(chats.value.filter((c) => c.type === 'dm'), me.value, nameOf))

const selected = ref('') // '' = Everyone
const current = computed(() => chats.value.find((c) => c.id === selected.value) ?? null)
// if the chat I was in is gone (deleted, or I was removed), go back to Everyone
watch(chats, () => { if (selected.value && !current.value) selected.value = '' })
const title = computed(() => (current.value ? chatTitle(current.value, me.value, nameOf) : 'Everyone'))
const canManageChat = computed(() => current.value?.type === 'group' && current.value.createdBy === me.value)
const canDeleteMessages = computed(() => (current.value ? current.value.createdBy === me.value : props.isAdmin))

// ----- panel for: new group / new direct message / manage this group -----
const panel = ref('') // '' | 'group' | 'dm' | 'manage'
const name = ref('')
const chosen = ref([])
const search = ref('')
const busy = ref(false)
const shownPeople = computed(() => members.value.filter((u) => displayOf(u).toLowerCase().includes(search.value.trim().toLowerCase())))

function open(kind) {
  panel.value = panel.value === kind ? '' : kind
  search.value = ''
  if (kind === 'group') { name.value = ''; chosen.value = [] }
  if (kind === 'manage' && current.value) { name.value = current.value.name; chosen.value = current.value.memberIds.filter((id) => id !== me.value) }
}
async function makeGroup() {
  const ids = [me.value, ...chosen.value]
  const problem = groupProblem(name.value, ids, Object.keys(props.workspace.members ?? {}))
  if (problem) { ui.toast(problem, 'error'); return }
  busy.value = true
  try { selected.value = await createChat(wid.value, { type: 'group', name: name.value, memberIds: ids }, auth.profile); panel.value = ''; ui.toast('Group created') }
  catch (e) { ui.toast(`Could not create the group: ${e.code ?? e.message}`, 'error') }
  busy.value = false
}
async function startDm(u) {
  const id = dmId(me.value, u.id)
  panel.value = ''
  if (chats.value.some((c) => c.id === id)) { selected.value = id; return }
  try { selected.value = await createChat(wid.value, { type: 'dm', memberIds: [me.value, u.id] }, auth.profile, id) }
  catch (e) { ui.toast(`Could not start the chat: ${e.code ?? e.message}`, 'error') }
}
async function saveGroup() {
  const ids = [me.value, ...chosen.value]
  const problem = groupProblem(name.value, ids, Object.keys(props.workspace.members ?? {}))
  if (problem) { ui.toast(problem, 'error'); return }
  busy.value = true
  try { await updateChat(wid.value, current.value.id, { name: name.value.trim(), memberIds: ids }); panel.value = ''; ui.toast('Group updated') }
  catch (e) { ui.toast(`Could not update the group: ${e.code ?? e.message}`, 'error') }
  busy.value = false
}
const confirmDelete = ref(false)
async function removeGroup() {
  confirmDelete.value = false
  const id = current.value.id
  try { await deleteConversation(wid.value, id); selected.value = ''; panel.value = ''; ui.toast('Group deleted') }
  catch (e) { ui.toast(`Could not delete the group: ${e.code ?? e.message}`, 'error') }
}
</script>

<template>
  <div class="grid h-[min(38rem,75vh)] overflow-hidden rounded-2xl border border-line bg-surface md:grid-cols-[15rem_1fr]">
    <!-- conversations -->
    <nav class="flex max-h-44 flex-col gap-0.5 overflow-y-auto border-b border-line bg-bg/40 p-2 md:max-h-none md:border-b-0 md:border-r" aria-label="Chats">
      <button type="button" class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-bold" :class="!selected ? 'bg-accent-soft text-accent' : 'hover:bg-bg'" @click="selected = ''"><Hash class="h-4 w-4" />Everyone</button>

      <div class="mt-2 flex items-center justify-between px-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">Groups
        <button type="button" class="rounded p-0.5 hover:text-accent" aria-label="New group" title="New group" @click="open('group')"><Plus class="h-3.5 w-3.5" /></button></div>
      <button v-for="g in groups" :key="g.id" type="button" class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-semibold" :class="selected === g.id ? 'bg-accent-soft text-accent' : 'hover:bg-bg'" @click="selected = g.id"><Users class="h-4 w-4 shrink-0" /><span class="truncate">{{ g.name }}</span></button>
      <p v-if="!groups.length" class="px-2 text-xs text-muted">No groups yet.</p>

      <div class="mt-2 flex items-center justify-between px-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">Direct messages
        <button type="button" class="rounded p-0.5 hover:text-accent" aria-label="New message" title="New message" @click="open('dm')"><Plus class="h-3.5 w-3.5" /></button></div>
      <button v-for="d in dms" :key="d.id" type="button" class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-semibold" :class="selected === d.id ? 'bg-accent-soft text-accent' : 'hover:bg-bg'" @click="selected = d.id">
        <UserAvatar :user="users[d.memberIds.find((x) => x !== me)] ?? {}" :size="20" /><span class="truncate">{{ chatTitle(d, me, nameOf) }}</span></button>
      <p v-if="!dms.length" class="px-2 text-xs text-muted">No direct messages yet.</p>
      <p v-if="loadFailed" class="px-2 text-xs font-semibold text-red-600" role="alert">Your chats could not be loaded.</p>
    </nav>

    <!-- the open conversation -->
    <div class="flex min-h-0 min-w-0 flex-col">
      <header class="flex items-center gap-2 border-b border-line px-4 py-2">
        <MessageCircle class="h-4 w-4 text-muted" />
        <h2 class="min-w-0 flex-1 truncate text-sm font-extrabold">{{ title }}<span v-if="current?.type === 'group'" class="ml-2 text-xs font-semibold text-muted">{{ current.memberIds.length }} people</span></h2>
        <button v-if="canManageChat" type="button" class="btn-ghost px-2 py-1 text-xs" @click="open('manage')"><Settings2 class="h-3.5 w-3.5" />Group settings</button>
      </header>

      <!-- new group / new message / group settings -->
      <div v-if="panel" class="space-y-2 border-b border-line bg-bg/50 p-3 text-sm">
        <template v-if="panel === 'dm'">
          <p class="font-bold">Message someone</p>
          <input v-model="search" class="input py-1.5" placeholder="Search members" aria-label="Search members" />
          <ul class="max-h-40 overflow-y-auto">
            <li v-for="u in shownPeople" :key="u.id"><button type="button" class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface" @click="startDm(u)"><UserAvatar :user="u" :size="24" /><span class="font-semibold">{{ displayOf(u) }}</span></button></li>
          </ul>
          <p v-if="!shownPeople.length" class="text-xs text-muted">No one else is in this workspace yet.</p>
        </template>
        <template v-else>
          <p class="font-bold">{{ panel === 'group' ? 'New group' : 'Group settings' }}</p>
          <input v-model="name" class="input py-1.5" maxlength="60" placeholder="Group name" aria-label="Group name" />
          <input v-model="search" class="input py-1.5" placeholder="Search members to add" aria-label="Search members to add" />
          <ul class="max-h-36 overflow-y-auto">
            <li v-for="u in shownPeople" :key="u.id"><label class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface"><input v-model="chosen" type="checkbox" :value="u.id" /><UserAvatar :user="u" :size="22" /><span class="font-semibold">{{ displayOf(u) }}</span></label></li>
          </ul>
          <div class="flex flex-wrap items-center justify-end gap-2">
            <button v-if="panel === 'manage'" type="button" class="btn-ghost mr-auto text-xs text-red-600" @click="confirmDelete = true">Delete group</button>
            <button type="button" class="btn-ghost text-xs" @click="panel = ''">Cancel</button>
            <button type="button" class="btn-primary text-xs" :disabled="busy" @click="panel === 'group' ? makeGroup() : saveGroup()">{{ panel === 'group' ? 'Create group' : 'Save' }}</button>
          </div>
        </template>
      </div>

      <div class="flex min-h-0 flex-1 flex-col"><WorkspaceChat :key="selected || 'everyone'" :workspace-id="wid" :workspace="workspace" :chat="current" :users="users" :is-admin="canDeleteMessages" /></div>
    </div>
    <ConfirmDialog v-if="confirmDelete" title="Delete this group?" message="The group and all of its messages are removed for everyone in it. This cannot be undone." @cancel="confirmDelete = false" @confirm="removeGroup" />
  </div>
</template>
