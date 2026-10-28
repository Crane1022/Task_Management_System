<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { MessageSquare, Pencil, Trash2, Send } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { subscribeComments, addComment, editComment, deleteComment } from '@/services/taskService'
import { formatDateTime } from '@/utils/dates'
import { displayOf } from '@/utils/constants'
import UserAvatar from './UserAvatar.vue'
import ConfirmDialog from './ConfirmDialog.vue'

// A task's discussion. Comments are stored with the task (tasks/{id}/comments), so only people who can read the task can read them.
const props = defineProps({ taskId: String, users: { type: Object, default: () => ({}) }, canComment: Boolean, canModerate: Boolean })
const auth = useAuthStore()
const ui = useUiStore()

const comments = ref([])
const loading = ref(true)
const failed = ref(false)
const text = ref('')
const busy = ref(false)
const editingId = ref('')
const editText = ref('')
const removing = ref(null)
const MAX = 2000

let unsub
onMounted(() => { unsub = subscribeComments(props.taskId, (c) => { comments.value = c; loading.value = false }, () => { failed.value = true; loading.value = false }) })
onUnmounted(() => unsub?.())

const mine = (c) => c.userId === auth.user?.uid
const canDelete = (c) => mine(c) || props.canModerate
const left = computed(() => MAX - text.value.length)

async function post() {
  const t = text.value.trim()
  if (!t || busy.value) return
  busy.value = true
  try { await addComment(props.taskId, t, auth.profile); text.value = '' }
  catch (e) { ui.toast(`Could not post the comment: ${e.code ?? e.message}`, 'error') }
  busy.value = false
}
function startEdit(c) { editingId.value = c.id; editText.value = c.text }
async function saveEdit(c) {
  const t = editText.value.trim()
  if (!t) return
  try { await editComment(props.taskId, c.id, t); editingId.value = '' }
  catch (e) { ui.toast(`Could not save the change: ${e.code ?? e.message}`, 'error') }
}
async function remove() {
  const c = removing.value
  removing.value = null
  try { await deleteComment(props.taskId, c.id) } catch (e) { ui.toast(`Could not delete the comment: ${e.code ?? e.message}`, 'error') }
}
</script>

<template>
  <section aria-label="Comments">
    <span class="label flex items-center gap-1"><MessageSquare class="h-3.5 w-3.5" />Comments <span v-if="comments.length" class="text-muted">({{ comments.length }})</span></span>
    <p v-if="loading" class="text-xs text-muted">Loading comments…</p>
    <p v-else-if="failed" class="text-xs font-semibold text-red-600" role="alert">The comments could not be loaded.</p>

    <ul v-if="comments.length" class="space-y-3">
      <li v-for="c in comments" :key="c.id" class="flex gap-2.5">
        <UserAvatar :user="users[c.userId] ?? { name: c.userName }" :size="30" />
        <div class="min-w-0 flex-1">
          <p class="text-xs"><b class="text-ink">{{ c.userName }}</b> <span class="text-muted">· {{ formatDateTime(c.createdAt) }}<template v-if="c.editedAt"> · edited</template></span></p>
          <template v-if="editingId === c.id">
            <textarea v-model="editText" rows="2" class="input mt-1" :maxlength="MAX" aria-label="Edit your comment" />
            <div class="mt-1 flex justify-end gap-2"><button type="button" class="btn-ghost py-1 text-xs" @click="editingId = ''">Cancel</button><button type="button" class="btn-primary py-1 text-xs" @click="saveEdit(c)">Save</button></div>
          </template>
          <p v-else class="mt-0.5 whitespace-pre-wrap break-words rounded-xl bg-bg px-3 py-2 text-sm">{{ c.text }}</p>
          <div v-if="editingId !== c.id && (canComment && mine(c) || canDelete(c))" class="mt-0.5 flex gap-3 text-[11px] font-semibold text-muted">
            <button v-if="canComment && mine(c)" type="button" class="hover:text-accent" @click="startEdit(c)"><Pencil class="mr-0.5 inline h-3 w-3" />Edit</button>
            <button v-if="canDelete(c)" type="button" class="hover:text-red-600" @click="removing = c"><Trash2 class="mr-0.5 inline h-3 w-3" />Delete</button>
          </div>
        </div>
      </li>
    </ul>
    <p v-else-if="!loading && !failed" class="text-xs text-muted">No comments yet.</p>

    <div v-if="canComment" class="mt-3 flex items-end gap-2">
      <div class="flex-1">
        <textarea v-model="text" rows="2" class="input" :maxlength="MAX" placeholder="Write a comment…" aria-label="Write a comment" @keydown.ctrl.enter.prevent="post" @keydown.meta.enter.prevent="post" />
        <p v-if="left < 200" class="mt-0.5 text-right text-[11px] text-muted">{{ left }} characters left</p>
      </div>
      <button type="button" class="btn-primary" :disabled="!text.trim() || busy" aria-label="Post comment" @click="post"><Send class="h-4 w-4" /></button>
    </div>
    <p v-else class="mt-2 text-xs text-muted">You can read this discussion but not add to it.</p>
    <ConfirmDialog v-if="removing" title="Delete this comment?" message="The comment is removed for everyone. This cannot be undone." @cancel="removing = null" @confirm="remove" />
  </section>
</template>
