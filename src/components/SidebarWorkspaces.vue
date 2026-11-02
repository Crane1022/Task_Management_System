<script setup>
import { ref, watch, nextTick } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { ChevronDown, ChevronRight, Lock, Folder, FolderOpen, GripVertical, Pencil, Trash2 } from 'lucide-vue-next'
import { useWorkspaceStore } from '@/stores/workspace'
import WorkspaceAvatar from '@/components/WorkspaceAvatar.vue'
import { buildTree, treeToLayout, normalizeTree, newFolderId, folderKey, cleanFolderName, MAX_FOLDER_NAME } from '@/utils/sidebarLayout'

// The workspace list in the sidebar: drag to reorder, put workspaces in folders, and an arrow that opens a workspace
// (its Boards / Members / Settings links) and shows its full name while it is open. All of it is personal to each person.
const props = defineProps({ collapsed: { type: Boolean, default: false } })
const emit = defineEmits(['navigate'])
const store = useWorkspaceStore()

const load = (key) => { try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } }
const save = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* private window: the choice just is not remembered */ } }

// ----- the arrow: opens the workspace and shows its full name (the name is cut short again when it is closed) -----
const openIds = ref(load('wb-ws-open'))
const isOpen = (id) => openIds.value.includes(id)
function toggleWs(id) { openIds.value = isOpen(id) ? openIds.value.filter((x) => x !== id) : [...openIds.value, id]; save('wb-ws-open', openIds.value) }
function expand(id) { if (!isOpen(id)) toggleWs(id) }

// ----- folders (open unless the person closed them) -----
const closedFolders = ref(load('wb-folders-closed'))
const folderOpen = (id) => !closedFolders.value.includes(id)
function toggleFolder(id) { closedFolders.value = folderOpen(id) ? [...closedFolders.value, id] : closedFolders.value.filter((x) => x !== id); save('wb-folders-closed', closedFolders.value) }

// ----- the tree that is drawn -----
const tree = ref([])
const dragging = ref(false)
watch(() => [store.workspaces, store.layout], () => {
  if (!dragging.value) tree.value = buildTree(store.workspaces.filter((w) => !w.archived), store.layout)
}, { immediate: true })

const persist = () => store.saveLayout(treeToLayout(normalizeTree(tree.value)))
const onStart = () => { dragging.value = true }
async function onEnd() {
  await nextTick() // read the lists after the drag library has updated them (not the DOM, which it puts back)
  tree.value = normalizeTree(tree.value) // a workspace moved between the list and a folder arrives in the other's shape
  dragging.value = false
  persist()
}
// a folder cannot go inside another folder; a workspace can go anywhere
const topGroup = { name: 'ws', pull: true, put: true }
const folderGroup = { name: 'ws', pull: true, put: (to, from, el) => el?.dataset?.kind === 'ws' }

// ----- new folder / rename / delete -----
const adding = ref(false)
const newName = ref('')
const editing = ref(null) // { id, text }
function startNewFolder() { adding.value = true; newName.value = '' }
function commitNew() {
  const name = cleanFolderName(newName.value)
  adding.value = false
  if (!name) return
  const id = newFolderId()
  tree.value = [{ kind: 'folder', key: folderKey(id), id, name, items: [] }, ...tree.value]
  persist()
}
function startRename(f) { editing.value = { id: f.id, text: f.name } }
function commitRename() {
  const e = editing.value
  editing.value = null
  const name = cleanFolderName(e?.text)
  const f = tree.value.find((x) => x.kind === 'folder' && x.id === e?.id)
  if (!f || !name || name === f.name) return
  f.name = name
  persist()
}
function removeFolder(f) {
  // the workspaces inside go back to the main list, where the folder was
  const i = tree.value.findIndex((x) => x.kind === 'folder' && x.id === f.id)
  if (i < 0) return
  tree.value.splice(i, 1, ...f.items.map((ws) => ({ kind: 'ws', key: 'w:' + ws.id, ws })))
  persist()
}

defineExpose({ startNewFolder, expand })
</script>

<template>
  <div>
    <form v-if="adding" class="flex items-center gap-1 px-2 pb-1" :class="props.collapsed && 'md:hidden'" @submit.prevent="commitNew">
      <input v-model="newName" class="input h-8 min-w-0 flex-1 py-1 text-sm" :maxlength="MAX_FOLDER_NAME" placeholder="Folder name" aria-label="New folder name" autofocus @keydown.esc="adding = false" />
      <button class="btn-primary px-2.5 py-1 text-xs">Add</button>
    </form>

    <VueDraggable v-model="tree" class="space-y-0.5" :animation="150" handle=".grip" :group="topGroup" ghost-class="opacity-40" @start="onStart" @end="onEnd">
      <div v-for="e in tree" :key="e.key" class="ws-row" :data-kind="e.kind">
        <!-- a workspace -->
        <template v-if="e.kind === 'ws'">
          <div class="flex items-start">
            <span class="grip mt-2 cursor-grab touch-none text-muted/60 hover:text-ink" :class="props.collapsed && 'md:hidden'" title="Drag to move" aria-hidden="true"><GripVertical class="h-3.5 w-3.5" /></span>
            <router-link :to="`/workspaces/${e.ws.id}`" exact-active-class="bg-accent-soft text-accent" class="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-muted hover:bg-bg" :title="e.ws.name" @click="emit('navigate')">
              <WorkspaceAvatar :workspace="e.ws" :size="22" class="shrink-0" />
              <span :class="[isOpen(e.ws.id) ? 'break-words' : 'truncate', props.collapsed && 'md:hidden']" style="min-width:0">{{ e.ws.name }}</span>
              <Lock v-if="e.ws.superPrivate" class="mt-0.5 h-3 w-3 shrink-0" :class="props.collapsed && 'md:hidden'" title="Super Private" aria-label="Super Private" />
            </router-link>
            <button class="mt-1 rounded p-1 text-muted hover:bg-bg" :class="props.collapsed && 'md:hidden'" :aria-expanded="isOpen(e.ws.id)" :aria-label="`${isOpen(e.ws.id) ? 'Hide full name and links for' : 'Show full name and links for'} ${e.ws.name}`" @click="toggleWs(e.ws.id)">
              <component :is="isOpen(e.ws.id) ? ChevronDown : ChevronRight" class="h-4 w-4" />
            </button>
          </div>
          <div class="collapsible" :class="[isOpen(e.ws.id) && 'open', props.collapsed && 'md:hidden']" :inert="isOpen(e.ws.id) ? null : ''">
            <div class="collapsible-clip">
              <div class="sub-links ml-[34px] space-y-0.5 border-l border-line pl-2">
                <router-link v-for="s in [{ p: '', l: 'Boards' }, { p: '/members', l: 'Members' }, { p: '/settings', l: 'Settings' }]" :key="s.l" :to="`/workspaces/${e.ws.id}${s.p}`"
                  exact-active-class="bg-accent-soft text-accent" class="block rounded-md px-2.5 py-1 text-[13px] font-semibold text-muted hover:bg-bg" @click="emit('navigate')">{{ s.l }}</router-link>
              </div>
            </div>
          </div>
        </template>

        <!-- a folder -->
        <template v-else>
          <div class="group flex items-center rounded-lg hover:bg-bg">
            <span class="grip cursor-grab touch-none text-muted/60 hover:text-ink" :class="props.collapsed && 'md:hidden'" title="Drag to move" aria-hidden="true"><GripVertical class="h-3.5 w-3.5" /></span>
            <form v-if="editing?.id === e.id" class="flex min-w-0 flex-1 items-center gap-1 py-0.5" @submit.prevent="commitRename">
              <input v-model="editing.text" class="input h-7 min-w-0 flex-1 py-0.5 text-sm" :maxlength="MAX_FOLDER_NAME" :aria-label="`Rename folder ${e.name}`" autofocus @keydown.esc="editing = null" @blur="commitRename" />
            </form>
            <button v-else type="button" class="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-bold text-muted" :aria-expanded="folderOpen(e.id)" :title="e.name" @click="toggleFolder(e.id)">
              <component :is="folderOpen(e.id) ? FolderOpen : Folder" class="h-[18px] w-[18px] shrink-0" />
              <span class="min-w-0 truncate" :class="props.collapsed && 'md:hidden'">{{ e.name }}</span>
              <span class="ml-auto shrink-0 text-xs font-semibold text-muted/70" :class="props.collapsed && 'md:hidden'">{{ e.items.length }}</span>
            </button>
            <template v-if="editing?.id !== e.id">
              <button class="rounded p-1 text-muted opacity-60 hover:bg-bg hover:text-ink focus:opacity-100 group-hover:opacity-100" :class="props.collapsed && 'md:hidden'" :aria-label="`Rename folder ${e.name}`" title="Rename" @click="startRename(e)"><Pencil class="h-3.5 w-3.5" /></button>
              <button class="rounded p-1 text-muted opacity-60 hover:bg-bg hover:text-red-600 focus:opacity-100 group-hover:opacity-100" :class="props.collapsed && 'md:hidden'" :aria-label="`Delete folder ${e.name}`" title="Delete folder (its workspaces stay)" @click="removeFolder(e)"><Trash2 class="h-3.5 w-3.5" /></button>
            </template>
          </div>
          <div class="collapsible" :class="[folderOpen(e.id) && 'open', props.collapsed && 'md:hidden']" :inert="folderOpen(e.id) ? null : ''"><div class="collapsible-clip">
          <VueDraggable v-model="e.items" class="folder-list sub-links ml-[18px] space-y-0.5 border-l border-line pl-1.5" :animation="150" handle=".grip" :group="folderGroup" ghost-class="opacity-40" @start="onStart" @end="onEnd">
            <div v-for="w in e.items" :key="w.id" class="ws-row" data-kind="ws">
              <div class="flex items-start">
                <span class="grip mt-2 cursor-grab touch-none text-muted/60 hover:text-ink" title="Drag to move" aria-hidden="true"><GripVertical class="h-3.5 w-3.5" /></span>
                <router-link :to="`/workspaces/${w.id}`" exact-active-class="bg-accent-soft text-accent" class="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-muted hover:bg-bg" :title="w.name" @click="emit('navigate')">
                  <WorkspaceAvatar :workspace="w" :size="22" class="shrink-0" />
                  <span :class="isOpen(w.id) ? 'break-words' : 'truncate'" style="min-width:0">{{ w.name }}</span>
                  <Lock v-if="w.superPrivate" class="mt-0.5 h-3 w-3 shrink-0" title="Super Private" aria-label="Super Private" />
                </router-link>
                <button class="mt-1 rounded p-1 text-muted hover:bg-bg" :aria-expanded="isOpen(w.id)" :aria-label="`${isOpen(w.id) ? 'Hide full name and links for' : 'Show full name and links for'} ${w.name}`" @click="toggleWs(w.id)">
                  <component :is="isOpen(w.id) ? ChevronDown : ChevronRight" class="h-4 w-4" />
                </button>
              </div>
              <div class="collapsible" :class="isOpen(w.id) && 'open'" :inert="isOpen(w.id) ? null : ''">
                <div class="collapsible-clip">
                  <div class="sub-links ml-[34px] space-y-0.5 border-l border-line pl-2">
                    <router-link v-for="s in [{ p: '', l: 'Boards' }, { p: '/members', l: 'Members' }, { p: '/settings', l: 'Settings' }]" :key="s.l" :to="`/workspaces/${w.id}${s.p}`"
                      exact-active-class="bg-accent-soft text-accent" class="block rounded-md px-2.5 py-1 text-[13px] font-semibold text-muted hover:bg-bg" @click="emit('navigate')">{{ s.l }}</router-link>
                  </div>
                </div>
              </div>
            </div>
          </VueDraggable>
          </div></div>
        </template>
      </div>
    </VueDraggable>
  </div>
</template>

<style scoped>
.folder-list { min-height: 26px; }
/* open and close smoothly: the row grows from 0 to its own height (no measuring needed), and a small gap opens under the name */
.collapsible { display: grid; grid-template-rows: 0fr; opacity: 0; visibility: hidden; transition: grid-template-rows 0.26s ease, opacity 0.2s ease, visibility 0s linear 0.26s; }
.collapsible.open { grid-template-rows: 1fr; opacity: 1; visibility: visible; transition: grid-template-rows 0.26s ease, opacity 0.2s ease 0.04s, visibility 0s; }
.collapsible-clip { min-height: 0; overflow: hidden; }
.sub-links { margin-top: 4px; margin-bottom: 2px; }
@media (prefers-reduced-motion: reduce) { .collapsible, .collapsible.open { transition: none; } }
.folder-list:empty::before { content: 'Drop workspaces here'; display: block; padding: 4px 8px; font-size: 12px; font-style: italic; color: var(--muted, #6b7280); }
</style>
