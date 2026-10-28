<script setup>
import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { RotateCcw } from 'lucide-vue-next'
import { useThemeStore } from '@/stores/theme'
import { useDashboardStore } from '@/stores/dashboard'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { PRESETS, PRESET_IDS, presetName, COLOR_FIELDS, FONT_RANGE, RADIUS_RANGE, PAGES, pageName, resolveTheme, dashboardLayer } from '@/utils/themes'
import { bgImageStyle } from '@/utils/backgrounds'
import { uploadBackground, deleteBackground, backgroundUrl } from '@/services/themeService'
import BackgroundPicker from './BackgroundPicker.vue'
import ThemePreview from './ThemePreview.vue'
import ConfirmDialog from './ConfirmDialog.vue'

// context = { dashboardId, pageKey } when opened from a dashboard; the scope choices then become
// "All pages / Current dashboard only / Current page only".
const props = defineProps({ context: Object, initialScope: { type: String, default: 'global' } })
const emit = defineEmits(['saved'])

const theme = useThemeStore()
const dash = useDashboardStore()
const auth = useAuthStore()
const ui = useUiStore()

const clone = (o) => JSON.parse(JSON.stringify(o ?? {}))
const scope = reactive({ type: props.initialScope, dashId: props.context?.dashboardId ?? '', pageKey: props.context?.pageKey ?? 'board' })
watch(() => dash.list, (l) => { if (!scope.dashId && l.length) scope.dashId = l[0].id }, { immediate: true })

const currentDash = computed(() => dash.list.find((d) => d.id === scope.dashId))
const source = computed(() => {
  if (scope.type === 'global') return theme.globalLayer
  if (scope.type === 'dashboard') return currentDash.value?.theme ?? {}
  return theme.pages[scope.pageKey] ?? {}
})

const original = ref({})
const draft = ref({})
const pending = ref(null) // { file, url } an image chosen but not uploaded yet
const saving = ref(false)
const progress = ref(0)
const error = ref('')
const confirmReset = ref(false)
const pendingScope = ref(null)

const dirty = computed(() => !!pending.value || JSON.stringify(draft.value) !== JSON.stringify(original.value))

function clearPending() { if (pending.value) URL.revokeObjectURL(pending.value.url); pending.value = null }
function load() { clearPending(); original.value = clone(source.value); draft.value = clone(source.value); error.value = '' }
load()
watch(() => [scope.type, scope.dashId, scope.pageKey], load)
watch(source, () => { if (!dirty.value) load() }, { deep: true })
onUnmounted(clearPending)

function requestScope(patch) {
  if (dirty.value) pendingScope.value = patch
  else Object.assign(scope, patch)
}
function discardAndSwitch() { Object.assign(scope, pendingScope.value); pendingScope.value = null }

// ---------- live preview ----------
const layers = computed(() => {
  if (scope.type === 'global') return [draft.value]
  if (scope.type === 'dashboard') return [theme.globalLayer, Object.keys(draft.value).length ? draft.value : dashboardLayer(currentDash.value)]
  return [theme.globalLayer, draft.value]
})
const preview = computed(() => resolveTheme(layers.value, theme.systemDark))
const previewBgUrl = ref('')
watch(() => [preview.value.background, pending.value], async () => {
  previewBgUrl.value = pending.value && preview.value.background?.type === 'upload' ? pending.value.url : await backgroundUrl(preview.value.background)
}, { immediate: true, deep: true })
const previewBgStyle = computed(() => bgImageStyle(preview.value.background, previewBgUrl.value))
const uploadThumb = computed(() => (draft.value.background?.type === 'upload' ? previewBgUrl.value : ''))

// ---------- edits ----------
const setPreset = (id) => { draft.value.preset = id; delete draft.value.colors }
const clearPreset = () => { delete draft.value.preset; delete draft.value.colors }
function setColor(key, value) { draft.value.colors = { ...draft.value.colors, [key]: value } }
function clearColor(key) {
  const c = { ...draft.value.colors }; delete c[key]
  if (Object.keys(c).length) draft.value.colors = c; else delete draft.value.colors
}
function onBackground(v) {
  if (v === undefined) delete draft.value.background; else draft.value.background = v
  if (v?.type !== 'upload') clearPending()
}
function onFile(file) {
  const prev = draft.value.background
  const keep = prev?.type === 'upload' ? prev : {}
  clearPending()
  pending.value = { file, url: URL.createObjectURL(file) }
  draft.value.background = { position: 'center', size: 'cover', overlay: 0.35, ...keep, type: 'upload', imageId: keep.imageId ?? '' }
}
function removeUpload() { clearPending(); draft.value.background = { type: 'none' } }

// ---------- saving ----------
const uploadId = (layer) => (layer?.background?.type === 'upload' ? layer.background.imageId : '')
async function writeLayer(layer) {
  if (scope.type === 'global') return theme.saveGlobal(layer)
  if (scope.type === 'page') return theme.savePage(scope.pageKey, layer)
  return dash.saveFor(scope.dashId, { theme: layer })
}
const friendly = (e) => ({
  'permission-denied': 'You are not allowed to save here. Check that the latest Firestore rules have been published.',
  'image/too-large': 'This image could not be shrunk enough to save. Try a smaller or simpler picture.',
}[e.code] ?? 'Something went wrong while saving. Please try again.')

async function save() {
  saving.value = true; error.value = ''
  let uploaded = ''
  try {
    const layer = clone(draft.value)
    if (pending.value) {
      uploaded = await uploadBackground(auth.user.uid, pending.value.file, (p) => (progress.value = p))
      layer.background = { ...layer.background, type: 'upload', imageId: uploaded }
    }
    if (layer.colors && !Object.keys(layer.colors).length) delete layer.colors
    if (await writeLayer(layer)) {
      const oldPath = uploadId(original.value)
      if (oldPath && oldPath !== uploadId(layer)) await deleteBackground(auth.user.uid, oldPath)
      clearPending()
      original.value = clone(layer); draft.value = clone(layer)
      ui.toast('Appearance saved')
      emit('saved')
    } else if (uploaded) await deleteBackground(auth.user.uid, uploaded)
  } catch (e) {
    console.error(e)
    error.value = friendly(e)
    if (uploaded) await deleteBackground(auth.user.uid, uploaded)
  } finally { saving.value = false; progress.value = 0 }
}

async function reset() {
  confirmReset.value = false
  saving.value = true
  if (await writeLayer({})) {
    const old = uploadId(original.value)
    if (old) await deleteBackground(auth.user.uid, old)
    ui.toast(scope.type === 'global' ? 'Back to the default look' : 'This scope now follows the look above it')
  }
  saving.value = false
}

const affects = computed(() => {
  if (scope.type === 'global') return 'Every page and every dashboard, unless a dashboard or page has its own setting.'
  if (scope.type === 'dashboard') return `Only the dashboard “${currentDash.value?.name ?? ''}”. Other dashboards and pages keep their own look.`
  return `Only the “${pageName(scope.pageKey)}” page. Other pages and dashboards keep their own look.`
})
const overridden = computed(() => {
  const over = theme.pages.dashboard
  if (scope.type !== 'dashboard' || !over) return ''
  const hit = Object.keys(draft.value).filter((k) => k in over)
  return hit.length ? `The “Dashboard” page has its own ${hit.join(', ')} setting, which takes priority over this dashboard.` : ''
})
const scopeOptions = computed(() => props.context
  ? [{ type: 'global', label: 'All pages' }, { type: 'dashboard', label: `Current dashboard only (${currentDash.value?.name ?? ''})` }, { type: 'page', label: `Current page only (${pageName(props.context.pageKey)})` }]
  : [{ type: 'global', label: 'Entire application' }, { type: 'dashboard', label: 'A specific dashboard' }, { type: 'page', label: 'A specific page' }])
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
    <div class="space-y-5">
      <section class="card">
        <h2 class="h">Where should this apply?</h2>
        <div class="space-y-2">
          <div v-for="o in scopeOptions" :key="o.type" class="flex flex-wrap items-center gap-3">
            <label class="flex items-center gap-2 text-sm font-semibold">
              <input type="radio" name="scope" class="accent-[var(--accent)]" :checked="scope.type === o.type" @change="requestScope({ type: o.type })" />{{ o.label }}
            </label>
            <select v-if="!context && o.type === 'dashboard' && scope.type === 'dashboard'" class="input w-52 py-1" :value="scope.dashId" aria-label="Dashboard" @change="requestScope({ dashId: $event.target.value })">
              <option v-for="d in dash.list" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
            <select v-if="!context && o.type === 'page' && scope.type === 'page'" class="input w-52 py-1" :value="scope.pageKey" aria-label="Page" @change="requestScope({ pageKey: $event.target.value })">
              <option v-for="p in PAGES" :key="p.key" :value="p.key">{{ p.name }}</option>
            </select>
          </div>
        </div>
        <p class="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm"><b>This will change:</b> {{ affects }}</p>
        <p v-if="overridden" class="mt-2 text-sm font-semibold text-amber-700 dark:text-amber-300">{{ overridden }}</p>
        <p class="mt-2 text-xs text-muted">Priority: a page's own look beats its dashboard's look, which beats the application-wide look.</p>
      </section>

      <section class="card">
        <h2 class="h">Theme</h2>
        <div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <button v-if="scope.type !== 'global'" type="button" class="tile" :class="!draft.preset && 'tile-on'" @click="clearPreset"><span class="grid h-10 place-items-center rounded-lg bg-bg text-xs text-muted">Inherit</span><span>Inherit</span></button>
          <button v-for="id in PRESET_IDS" :key="id" type="button" class="tile" :class="draft.preset === id && 'tile-on'" :aria-pressed="draft.preset === id" @click="setPreset(id)">
            <span class="flex h-10 overflow-hidden rounded-lg border border-line">
              <template v-if="id === 'system'"><span class="flex-1" :style="{ background: PRESETS.light.c.background }" /><span class="flex-1" :style="{ background: PRESETS.dark.c.background }" /></template>
              <template v-else><span class="flex-1" :style="{ background: PRESETS[id].c.background }" /><span class="w-1/3" :style="{ background: PRESETS[id].c.primary }" /><span class="w-1/4" :style="{ background: PRESETS[id].c.accent }" /></template>
            </span><span>{{ presetName(id) }}</span>
          </button>
        </div>
        <p v-if="draft.preset === 'system'" class="mt-2 text-xs text-muted">System follows your device: light by day, dark when your device is in dark mode.</p>
      </section>

      <section class="card">
        <h2 class="h">Custom colours</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <div v-for="f in COLOR_FIELDS" :key="f.key" class="flex items-center gap-3">
            <input :id="'c-' + f.key" type="color" class="h-9 w-12 cursor-pointer rounded-lg border border-line bg-surface p-0.5" :value="preview.colors[f.key]" @input="setColor(f.key, $event.target.value)" />
            <label :for="'c-' + f.key" class="min-w-0 flex-1"><span class="block text-sm font-bold">{{ f.label }}</span><span class="block truncate text-xs text-muted">{{ f.hint }}</span></label>
            <button v-if="draft.colors?.[f.key]" type="button" class="text-xs font-semibold text-accent" @click="clearColor(f.key)">Reset</button>
          </div>
        </div>
      </section>

      <section class="card">
        <h2 class="h">Size and shape</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <div><label class="label" for="fs">Text size: {{ draft.fontSize ?? preview.fontScale }}%</label>
            <input id="fs" type="range" class="w-full accent-[var(--accent)]" v-bind="FONT_RANGE" :value="draft.fontSize ?? preview.fontScale" @input="draft.fontSize = Number($event.target.value)" /></div>
          <div><label class="label" for="rd">Rounded corners: {{ (draft.radius ?? preview.radius).toFixed(1) }}x</label>
            <input id="rd" type="range" class="w-full accent-[var(--accent)]" v-bind="RADIUS_RANGE" :value="draft.radius ?? preview.radius" @input="draft.radius = Number($event.target.value)" /></div>
        </div>
        <label v-if="scope.type === 'global'" class="mt-4 flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" class="accent-[var(--accent)]" :checked="!!draft.reduceMotion" @change="draft.reduceMotion = $event.target.checked" />Reduce motion (switches off animations, including the cats' pop-ups)
        </label>
      </section>

      <section class="card">
        <h2 class="h">Background image</h2>
        <BackgroundPicker :model-value="draft.background" :upload-url="uploadThumb" :allow-inherit="scope.type !== 'global'" :busy="saving" @update:model-value="onBackground" @file="onFile" @remove-upload="removeUpload" />
      </section>
    </div>

    <aside class="space-y-3 self-start lg:sticky lg:top-0">
      <h2 class="h">Live preview</h2>
      <ThemePreview :vars="preview.vars" :bg-style="previewBgStyle" :overlay="preview.background?.overlay ?? 0.35" :font-scale="preview.fontScale" />
      <div v-if="saving && pending" class="h-2 overflow-hidden rounded-full bg-line" role="progressbar" :aria-valuenow="Math.round(progress * 100)"><div class="h-full bg-accent transition-all" :style="{ width: progress * 100 + '%' }" /></div>
      <p v-if="error" class="text-sm font-semibold text-red-600" role="alert">{{ error }}</p>
      <div class="flex gap-2">
        <button class="btn-primary flex-1" :disabled="!dirty || saving" @click="save">{{ saving ? (pending ? 'Uploading…' : 'Saving…') : 'Save' }}</button>
        <button class="btn-ghost" :disabled="saving" @click="confirmReset = true"><RotateCcw class="h-4 w-4" />Reset</button>
      </div>
      <p v-if="dirty" class="text-xs text-muted">You have unsaved changes. Nothing is applied until you press Save.</p>
    </aside>

    <ConfirmDialog v-if="confirmReset" title="Reset this look?" :message="scope.type === 'global' ? 'Your application-wide look goes back to the default Light theme.' : 'This scope loses its own settings and follows the look above it. Any uploaded image for it is deleted.'" confirm-text="Reset" @cancel="confirmReset = false" @confirm="reset" />
    <ConfirmDialog v-if="pendingScope" title="Discard unsaved changes?" message="You changed this look but have not saved it. Switching will discard those changes." confirm-text="Discard" @cancel="pendingScope = null" @confirm="discardAndSwitch" />
  </div>
</template>

<style scoped>
.card { @apply rounded-2xl border border-line bg-surface p-4 shadow-card; }
.h { @apply mb-3 text-sm font-extrabold; }
.tile { @apply flex flex-col gap-1 rounded-xl border border-line bg-surface p-1.5 text-left text-[11px] font-bold text-muted hover:border-highlight; }
.tile-on { @apply border-accent text-ink ring-2 ring-accent; }
</style>
