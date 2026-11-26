<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Paperclip, Plus, Trash2, FileText, FileSpreadsheet, Image as ImageIcon, Presentation, FileArchive, File as FileIcon, ExternalLink, Upload, Link2, Download, X } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { addAttachment, removeAttachment } from '@/services/taskService'
import { uploadTaskFile, fileThumb, loadTaskFile, saveBlob, deleteTaskFile } from '@/services/fileService'
import { parseLink, isSafeHref, KIND_LABEL, MAX_ATTACHMENTS } from '@/utils/links'
import { checkFile, formatSize, openMode, MAX_FILE_BYTES } from '@/utils/files'
import { formatDate } from '@/utils/dates'
import ConfirmDialog from './ConfirmDialog.vue'

// Attachments are either
//  - files uploaded here (pictures, PDF, Word, Excel…), kept in Firestore with the same permissions as the task, or
//  - links to files kept elsewhere (Google Drive, OneDrive, SharePoint, Dropbox, the company file server).
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
const isUpload = (a) => !!a.fileId

const icons = { pdf: FileText, word: FileText, excel: FileSpreadsheet, slides: Presentation, image: ImageIcon, archive: FileArchive, other: FileIcon }

// ----- links -----
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

// ----- uploads: the button, drag and drop, or Ctrl+V of a screenshot -----
const picker = ref(null)
const uploads = ref([]) // [{ key, name, progress }] files being uploaded right now
const dragging = ref(false)

async function uploadFiles(list) {
  if (!props.canEdit) return
  const files = [...list]
  if (!files.length) return
  error.value = ''
  const room = MAX_ATTACHMENTS - props.attachments.length - uploads.value.length
  if (files.length > room) {
    ui.toast(room > 0 ? `Only ${room} more attachment${room === 1 ? '' : 's'} fit on this task.` : `A task can have up to ${MAX_ATTACHMENTS} attachments.`, 'error')
    files.splice(Math.max(0, room))
  }
  for (const file of files) {
    const problem = checkFile(file)
    if (problem) { ui.toast(problem, 'error'); continue }
    uploads.value.push({ key: crypto.randomUUID(), name: file.name || 'Screenshot', progress: 0 })
    const row = uploads.value[uploads.value.length - 1] // the reactive copy, so the progress bar moves
    try {
      await ui.track(() => uploadTaskFile(props.taskId, file, auth.profile, (p) => { row.progress = p }))
      ui.toast(`Uploaded ${row.name}`)
    } catch (e) {
      ui.toast(e.code === 'attachments/limit' ? e.message : `Could not upload ${row.name}: ${e.code ?? e.message}`, 'error')
    } finally {
      uploads.value = uploads.value.filter((u) => u.key !== row.key)
    }
  }
}
function picked(e) { uploadFiles(e.target.files); e.target.value = '' }
function drop(e) { dragging.value = false; uploadFiles(e.dataTransfer?.files ?? []) }
function dragOver(e) { if (props.canEdit && [...(e.dataTransfer?.types ?? [])].includes('Files')) { e.preventDefault(); dragging.value = true } }
// a pasted picture (Print Screen, Snipping Tool, a copied image) is uploaded; pasted text is left alone
function paste(e) {
  if (!props.canEdit || full.value) return
  const files = [...(e.clipboardData?.files ?? [])]
  if (!files.length) return
  e.preventDefault()
  uploadFiles(files)
}
onMounted(() => document.addEventListener('paste', paste))
onBeforeUnmount(() => document.removeEventListener('paste', paste))

// small preview pictures for uploaded photos
const thumbs = ref({})
watch(() => props.attachments.filter((a) => isUpload(a) && a.kind === 'image').map((a) => a.fileId), (ids) => {
  for (const id of ids) {
    if (id in thumbs.value) continue
    thumbs.value[id] = null
    fileThumb(props.taskId, id).then((t) => { thumbs.value[id] = t })
  }
}, { immediate: true })

// ----- opening an uploaded file -----
const opening = ref(null)
const viewer = ref(null) // { name, url, attachment } for a picture shown in the app
async function openFile(a) {
  const mode = openMode(a.type ?? '')
  // a PDF opens in a new tab: the tab must be opened right away or the browser blocks it as a pop-up
  const tab = mode === 'pdf' ? window.open('', '_blank') : null
  opening.value = a.id
  try {
    const blob = await ui.track(() => loadTaskFile(props.taskId, a))
    if (mode === 'image') viewer.value = { name: a.name, url: URL.createObjectURL(blob), attachment: a }
    else if (mode === 'pdf' && tab) { tab.opener = null; tab.location.href = URL.createObjectURL(blob) }
    else saveBlob(blob, a.name)
  } catch (e) {
    tab?.close()
    ui.toast(e.message && e.code?.startsWith('file/') ? e.message : `Could not open ${a.name}: ${e.code ?? e.message}`, 'error')
  } finally { opening.value = null }
}
async function download(a) {
  opening.value = a.id
  try { saveBlob(await ui.track(() => loadTaskFile(props.taskId, a)), a.name) }
  catch (e) { ui.toast(`Could not download ${a.name}: ${e.code ?? e.message}`, 'error') }
  finally { opening.value = null }
}
function closeViewer() { if (viewer.value) URL.revokeObjectURL(viewer.value.url); viewer.value = null }
const onKey = (e) => { if (e.key === 'Escape' && viewer.value) { e.stopPropagation(); closeViewer() } }
watch(viewer, (v) => (v ? window.addEventListener('keydown', onKey, true) : window.removeEventListener('keydown', onKey, true)))
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey, true); closeViewer() })

// ----- removing -----
async function remove() {
  const a = removing.value
  removing.value = null
  try {
    await ui.track(() => removeAttachment(props.taskId, a.id, auth.profile))
    if (isUpload(a)) deleteTaskFile(props.taskId, a.fileId) // an uploaded file is deleted for good
    ui.toast('Attachment removed')
  } catch (e) { ui.toast(e.code === 'attachments/gone' ? e.message : `Could not remove it: ${e.code ?? e.message}`, 'error') }
}
</script>

<template>
  <section
    aria-label="Attachments" class="relative rounded-xl transition-colors" :class="dragging && 'bg-accent/5 ring-2 ring-accent'"
    @dragover="dragOver" @dragleave.self="dragging = false" @drop.prevent="drop"
  >
    <div class="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <span class="label mb-0 flex items-center gap-1"><Paperclip class="h-3.5 w-3.5" />Attachments <span v-if="attachments.length" class="text-muted">({{ attachments.length }})</span></span>
      <div v-if="canEdit" class="flex items-center gap-3">
        <button type="button" class="flex min-h-[32px] items-center text-xs font-bold text-accent disabled:opacity-50" :disabled="full" @click="picker.click()"><Upload class="mr-1 h-3.5 w-3.5" />Upload file</button>
        <button v-if="!open" type="button" class="flex min-h-[32px] items-center text-xs font-bold text-accent disabled:opacity-50" :disabled="full" @click="open = true"><Link2 class="mr-1 h-3.5 w-3.5" />Add a link</button>
      </div>
      <input ref="picker" type="file" multiple class="hidden" @change="picked" />
    </div>

    <ul v-if="attachments.length || uploads.length" class="space-y-1.5">
      <li v-for="a in attachments" :key="a.id" class="flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-1.5">
        <!-- uploaded photo: its preview picture, click to see it big -->
        <button v-if="isUpload(a) && thumbs[a.fileId]" type="button" class="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-line" :aria-label="`View ${a.name}`" @click="openFile(a)">
          <img :src="thumbs[a.fileId]" alt="" class="h-full w-full object-cover" />
        </button>
        <component :is="icons[a.kind] ?? FileIcon" v-else class="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <button v-if="isUpload(a)" type="button" v-busy="opening === a.id" class="block max-w-full truncate text-left text-sm font-bold hover:text-accent" @click="openFile(a)">{{ a.name }}</button>
          <a v-else-if="isSafeHref(a.url)" :href="a.url" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1 truncate text-sm font-bold hover:text-accent">{{ a.name }}<ExternalLink class="h-3 w-3 shrink-0 opacity-60" /></a>
          <span v-else class="truncate text-sm font-bold">{{ a.name }} <span class="text-xs font-normal text-red-600">(unsafe link, not clickable)</span></span>
          <p class="truncate text-[11px] text-muted">{{ a.provider }} · {{ KIND_LABEL[a.kind] ?? 'File' }}<template v-if="a.size"> · {{ formatSize(a.size) }}</template><template v-if="a.addedByName"> · added by {{ a.addedByName }}</template><template v-if="a.addedAt"> · {{ formatDate({ toDate: () => new Date(a.addedAt) }) }}</template></p>
        </div>
        <button v-if="isUpload(a)" type="button" class="rounded p-1 text-muted hover:text-accent" :aria-label="`Download ${a.name}`" @click="download(a)"><Download class="h-4 w-4" /></button>
        <button v-if="canEdit" type="button" class="rounded p-1 text-muted hover:text-red-600" :aria-label="`Remove ${a.name}`" @click="removing = a"><Trash2 class="h-4 w-4" /></button>
      </li>
      <!-- still uploading -->
      <li v-for="u in uploads" :key="u.key" class="rounded-lg border border-dashed border-accent/60 px-2.5 py-1.5" aria-live="polite">
        <div class="flex items-center gap-2.5">
          <Upload class="h-5 w-5 shrink-0 animate-pulse text-accent" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate text-sm font-bold">{{ u.name }}</span>
          <span class="text-[11px] font-bold text-muted">{{ Math.round(u.progress * 100) }}%</span>
        </div>
        <div class="mt-1.5 h-1 overflow-hidden rounded-full bg-line"><div class="h-full bg-accent transition-all duration-300" :style="{ width: Math.max(4, u.progress * 100) + '%' }" /></div>
      </li>
    </ul>
    <p v-else-if="!open" class="text-xs text-muted">
      No attachments.
      <template v-if="canEdit">Upload a picture or file (up to {{ formatSize(MAX_FILE_BYTES) }}), drag one here, paste a screenshot with Ctrl+V, or add a link to Google Drive, OneDrive or the company file server.</template>
    </p>
    <p v-if="dragging" class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-white/80 text-sm font-bold text-accent dark:bg-black/60">Drop to upload</p>

    <div v-if="open" class="mt-2 space-y-2 rounded-xl border border-dashed border-line p-3">
      <div><label class="label" for="att-url">Link to the file</label><input id="att-url" v-model="url" class="input" type="url" inputmode="url" placeholder="https://drive.google.com/…" autocomplete="off" @keydown.enter.prevent="add" /></div>
      <div><label class="label" for="att-name">Name (optional)</label><input id="att-name" v-model="name" class="input" maxlength="120" placeholder="Taken from the link if left empty" @keydown.enter.prevent="add" /></div>
      <p v-if="error" class="text-xs font-semibold text-red-600" role="alert">{{ error }}</p>
      <p class="text-[11px] text-muted">Only the link is saved. Make sure the people who need the file have access to it in its own service.</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-ghost py-1" @click="open = false; error = ''">Cancel</button>
        <button type="button" v-busy="busy" class="btn-primary py-1" @click="add">{{ busy ? 'Adding…' : 'Add attachment' }}</button>
      </div>
    </div>

    <ConfirmDialog
      v-if="removing" title="Remove this attachment?"
      :message="isUpload(removing) ? `“${removing.name}” is removed from the task and the uploaded file is deleted.` : `“${removing.name}” is removed from the task. The file itself is not deleted.`"
      confirm-text="Remove" @cancel="removing = null" @confirm="remove"
    />

    <!-- picture viewer -->
    <Teleport to="body">
      <div v-if="viewer" class="fixed inset-0 z-[80] flex flex-col bg-black/85 p-3 sm:p-6" role="dialog" aria-modal="true" :aria-label="viewer.name" @click.self="closeViewer">
        <div class="mb-2 flex items-center gap-2 text-white">
          <span class="min-w-0 flex-1 truncate text-sm font-bold">{{ viewer.name }}</span>
          <button type="button" class="flex min-h-[40px] items-center gap-1 rounded-lg px-3 text-sm font-bold hover:bg-white/10" @click="download(viewer.attachment)"><Download class="h-4 w-4" />Download</button>
          <button type="button" class="rounded-lg p-2 hover:bg-white/10" aria-label="Close" @click="closeViewer"><X class="h-5 w-5" /></button>
        </div>
        <div class="flex min-h-0 flex-1 items-center justify-center" @click.self="closeViewer">
          <img :src="viewer.url" :alt="viewer.name" class="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
        </div>
      </div>
    </Teleport>
  </section>
</template>
