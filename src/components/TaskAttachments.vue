<script setup>
import { ref, computed } from 'vue'
import { Paperclip, Plus, Trash2, FileText, FileSpreadsheet, Image as ImageIcon, Presentation, FileArchive, File as FileIcon, ExternalLink } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { addAttachment, removeAttachment } from '@/services/taskService'
import { parseLink, isSafeHref, KIND_LABEL, MAX_ATTACHMENTS } from '@/utils/links'
import { formatDate } from '@/utils/dates'
import ConfirmDialog from './ConfirmDialog.vue'

// Attachments are links to files kept elsewhere (Google Drive, OneDrive, SharePoint, Dropbox, the company file server).
// Nothing is uploaded here, so there is no file storage to set up. The list is part of the task, so it follows the task's permissions.
const props = defineProps({ taskId: String, attachments: { type: Array, default: () => [] }, canEdit: Boolean })
const auth = useAuthStore()
const ui = useUiStore()

// optional: extra host names that mean "our company file server", e.g. VITE_FILE_SERVER_HOSTS=files.widebed.com.my,nas.widebed.local
const serverHosts = (import.meta.env.VITE_FILE_SERVER_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean)

const open = ref(false)
const url = ref('')
const name = ref('')
const error = ref('')
const busy = ref(false)
const removing = ref(null)
const full = computed(() => props.attachments.length >= MAX_ATTACHMENTS)

const icons = { pdf: FileText, word: FileText, excel: FileSpreadsheet, slides: Presentation, image: ImageIcon, archive: FileArchive, other: FileIcon }

async function add() {
  error.value = ''
  const link = parseLink(url.value, name.value, serverHosts)
  if (link.error) { error.value = link.error; return }
  busy.value = true
  try {
    await addAttachment(props.taskId, {
      id: crypto.randomUUID(), name: link.name, url: link.url, provider: link.provider, kind: link.kind,
      addedBy: auth.user.uid, addedByName: auth.profile.displayName || auth.profile.name, addedAt: Date.now(),
    }, auth.profile)
    url.value = ''; name.value = ''; open.value = false
    ui.toast('Attachment added')
  } catch (e) {
    error.value = ['attachments/duplicate', 'attachments/limit'].includes(e.code) ? e.message : `Could not add the attachment: ${e.code ?? e.message}`
  } finally { busy.value = false }
}
async function remove() {
  const a = removing.value
  removing.value = null
  try { await removeAttachment(props.taskId, a.id, auth.profile); ui.toast('Attachment removed') }
  catch (e) { ui.toast(e.code === 'attachments/gone' ? e.message : `Could not remove it: ${e.code ?? e.message}`, 'error') }
}
</script>

<template>
  <section aria-label="Attachments">
    <div class="mb-1 flex items-center justify-between">
      <span class="label mb-0 flex items-center gap-1"><Paperclip class="h-3.5 w-3.5" />Attachments <span v-if="attachments.length" class="text-muted">({{ attachments.length }})</span></span>
      <button v-if="canEdit && !open" type="button" class="text-xs font-bold text-accent disabled:opacity-50" :disabled="full" @click="open = true"><Plus class="mr-0.5 inline h-3.5 w-3.5" />Add a link</button>
    </div>

    <ul v-if="attachments.length" class="space-y-1.5">
      <li v-for="a in attachments" :key="a.id" class="flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-1.5">
        <component :is="icons[a.kind] ?? FileIcon" class="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <a v-if="isSafeHref(a.url)" :href="a.url" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1 truncate text-sm font-bold hover:text-accent">{{ a.name }}<ExternalLink class="h-3 w-3 shrink-0 opacity-60" /></a>
          <span v-else class="truncate text-sm font-bold">{{ a.name }} <span class="text-xs font-normal text-red-600">(unsafe link, not clickable)</span></span>
          <p class="truncate text-[11px] text-muted">{{ a.provider }} · {{ KIND_LABEL[a.kind] ?? 'File' }}<template v-if="a.addedByName"> · added by {{ a.addedByName }}</template><template v-if="a.addedAt"> · {{ formatDate({ toDate: () => new Date(a.addedAt) }) }}</template></p>
        </div>
        <button v-if="canEdit" type="button" class="rounded p-1 text-muted hover:text-red-600" :aria-label="`Remove ${a.name}`" @click="removing = a"><Trash2 class="h-4 w-4" /></button>
      </li>
    </ul>
    <p v-else-if="!open" class="text-xs text-muted">No attachments. {{ canEdit ? 'Add a link to a file in Google Drive, OneDrive, SharePoint, Dropbox or the company file server.' : '' }}</p>

    <div v-if="open" class="mt-2 space-y-2 rounded-xl border border-dashed border-line p-3">
      <div><label class="label" for="att-url">Link to the file</label><input id="att-url" v-model="url" class="input" type="url" inputmode="url" placeholder="https://drive.google.com/…" autocomplete="off" @keydown.enter.prevent="add" /></div>
      <div><label class="label" for="att-name">Name (optional)</label><input id="att-name" v-model="name" class="input" maxlength="120" placeholder="Taken from the link if left empty" @keydown.enter.prevent="add" /></div>
      <p v-if="error" class="text-xs font-semibold text-red-600" role="alert">{{ error }}</p>
      <p class="text-[11px] text-muted">Only the link is saved. Make sure the people who need the file have access to it in its own service.</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-ghost py-1" @click="open = false; error = ''">Cancel</button>
        <button type="button" class="btn-primary py-1" :disabled="busy" @click="add">{{ busy ? 'Adding…' : 'Add attachment' }}</button>
      </div>
    </div>
    <ConfirmDialog v-if="removing" title="Remove this attachment?" :message="`“${removing.name}” is removed from the task. The file itself is not deleted.`" confirm-text="Remove" @cancel="removing = null" @confirm="remove" />
  </section>
</template>
