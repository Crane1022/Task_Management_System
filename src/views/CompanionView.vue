<script setup>
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { Upload, Trash2, RotateCcw, Check, Volume2, Info, TriangleAlert } from 'lucide-vue-next'
import { useCompanionStore } from '@/stores/companion'
import { useThemeStore } from '@/stores/theme'
import { useUiStore } from '@/stores/ui'
import { PARTS, CUSTOM_ID, DEFAULT_ANIMAL, getAnimal } from '@/companions/registry'
import {
  SIZE, NAME_MAX, effectiveColors, selectAnimal, toggleFavourite, resetColor, resetAppearance, resetFace, restoreOriginalAnimal,
} from '@/companions/settings'
import { ACCESSORIES } from '@/companions/accessories'
import { ACCEPT, validateFile } from '@/companions/imageValidate'
import { playVoice } from '@/companions/sound'
import CompanionAvatar from '@/components/CompanionAvatar.vue'
import AnimalLibrary from '@/components/AnimalLibrary.vue'
import ImageCropper from '@/components/ImageCropper.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

// "My companion": choose, customise and set up the pet. Everything is edited as a draft;
// nothing changes for real until "Apply changes".
const store = useCompanionStore()
const theme = useThemeStore()
const ui = useUiStore()

const TABS = [
  { id: 'choose', label: 'Choose companion' }, { id: 'appearance', label: 'Appearance' }, { id: 'upload', label: 'Upload' },
  { id: 'size', label: 'Size and position' }, { id: 'behaviour', label: 'Behaviour' }, { id: 'reset', label: 'Reset' },
]
const SWATCHES = ['#ffffff', '#f3efe8', '#e8d3b5', '#c58f5a', '#8a5a3b', '#3a2a22', '#2b2b2b', '#a9b0b8', '#e8793a', '#ffd23f', '#6cbf5a', '#7aa8ff', '#b79df0', '#f08fa3', '#e63946']
const clone = (o) => JSON.parse(JSON.stringify(o))

const tab = ref('choose')
const draft = ref(clone(store.settings))
const pending = reactive({ custom: undefined, face: undefined }) // Blob = store, null = delete, undefined = unchanged
const pendingUrls = reactive({ custom: '', face: '' })
const browsing = ref('')
const activePart = ref('body')
const saving = ref(false)
const cropping = ref(null) // { kind, file }
const uploadError = reactive({ custom: '', face: '' })
const confirmAll = ref(false)
const inputs = reactive({ custom: null, face: null })

const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(store.settings) || pending.custom !== undefined || pending.face !== undefined)
function revokePending() {
  for (const k of ['custom', 'face']) { if (pendingUrls[k]) URL.revokeObjectURL(pendingUrls[k]); pendingUrls[k] = ''; pending[k] = undefined }
}
function reload() { revokePending(); draft.value = clone(store.settings); browsing.value = '' }
watch(() => store.settings, () => { if (!dirty.value) reload() }, { deep: true })
onBeforeUnmount(revokePending)

// what the preview shows right now
const customUrl = computed(() => (pending.custom === null ? '' : pendingUrls.custom || store.urls.custom))
const faceUrl = computed(() => (pending.face === null ? '' : pendingUrls.face || store.urls.face))
const previewId = computed(() => browsing.value || draft.value.animalId)
const previewingOther = computed(() => !!browsing.value && browsing.value !== draft.value.animalId)
const shownAnimalId = computed(() => (previewId.value === CUSTOM_ID && !customUrl.value ? DEFAULT_ANIMAL : previewId.value))
const animal = computed(() => getAnimal(shownAnimalId.value))
const isCustom = computed(() => draft.value.animalId === CUSTOM_ID)
const colors = computed(() => (previewingOther.value ? {} : draft.value.colors))
const currentColors = computed(() => effectiveColors(shownAnimalId.value, colors.value))
const parts = computed(() => PARTS.filter((p) => animal.value?.parts.includes(p.key)))
watch(parts, (list) => { if (!list.some((p) => p.key === activePart.value)) activePart.value = list[0]?.key ?? 'body' })
const customMissing = computed(() => draft.value.custom.hasImage && !customUrl.value)
const faceMissing = computed(() => draft.value.face.hasImage && !faceUrl.value)

const reducedOs = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const animated = computed(() => draft.value.behaviour.animations && !reducedOs && !theme.effective.reduceMotion)
const previewState = ref('idle')
let stateTimer
function show(state, ms = 1800) { previewState.value = state; clearTimeout(stateTimer); if (ms) stateTimer = setTimeout(() => (previewState.value = 'idle'), ms) }
onBeforeUnmount(() => clearTimeout(stateTimer))

// ----- choosing -----
const choose = () => { draft.value = selectAnimal(draft.value, browsing.value); browsing.value = '' }
const fav = (id) => { draft.value = toggleFavourite(draft.value, id) }
const useCustomTile = () => { tab.value = 'upload'; if (draft.value.custom.hasImage && customUrl.value) browsing.value = '' }

// ----- appearance -----
const setColor = (part, hex) => { draft.value.colors = { ...draft.value.colors, [part]: hex.toLowerCase() } }
const clearColor = (part) => { draft.value = resetColor(draft.value, part) }

// ----- uploads (checked, then cropped, then kept on this device) -----
async function onFile(e, kind) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  uploadError[kind] = ''
  try { uploadError[kind] = await validateFile(file) } catch { uploadError[kind] = 'That file could not be read.' }
  if (!uploadError[kind]) cropping.value = { kind, file }
}
function cropped(blob) {
  const kind = cropping.value.kind
  cropping.value = null
  if (pendingUrls[kind]) URL.revokeObjectURL(pendingUrls[kind])
  pending[kind] = blob
  pendingUrls[kind] = URL.createObjectURL(blob)
  if (kind === 'custom') { draft.value.custom.hasImage = true; draft.value = { ...draft.value, animalId: CUSTOM_ID, colors: {} }; browsing.value = '' }
  else draft.value.face = { ...draft.value.face, hasImage: true, zoom: 1, x: 0, y: 0 }
}
function deleteCustom() {
  if (pendingUrls.custom) URL.revokeObjectURL(pendingUrls.custom)
  pendingUrls.custom = ''; pending.custom = null
  draft.value.custom.hasImage = false
  if (draft.value.animalId === CUSTOM_ID) draft.value = selectAnimal(draft.value, DEFAULT_ANIMAL)
}
function removeFace() {
  if (pendingUrls.face) URL.revokeObjectURL(pendingUrls.face)
  pendingUrls.face = ''; pending.face = null
  draft.value = resetFace(draft.value)
}

// ----- the resets -----
const restoreAnimal = () => { draft.value = restoreOriginalAnimal(draft.value); browsing.value = '' }
const resetAppearanceNow = () => { draft.value = resetAppearance(draft.value) }
function resetPositionNow() { store.resetPosition(); ui.toast('Position reset') }
async function resetEverything() {
  confirmAll.value = false
  if (await store.resetEverything()) { reload(); ui.toast('Companion reset to the default') }
}

// ----- apply / cancel -----
async function apply() {
  saving.value = true
  const ok = await store.save(draft.value, { custom: pending.custom, face: pending.face })
  saving.value = false
  if (ok) { revokePending(); draft.value = clone(store.settings); ui.toast('Companion saved') }
}
function cancel() { reload(); ui.toast('Changes discarded') }
const testSound = () => playVoice(animal.value?.voice, draft.value.behaviour.volume)
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto max-w-6xl px-4 pb-6 pt-4">
      <h1 class="text-lg font-extrabold">My companion</h1>
      <p class="mt-1 text-sm text-muted">Pick an animal (or your own picture), make it yours, and drag it anywhere on the screen.</p>

      <div class="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <nav class="flex flex-wrap gap-1 border-b border-line" role="tablist" aria-label="Companion settings">
            <button v-for="t in TABS" :key="t.id" role="tab" :aria-selected="tab === t.id" class="-mb-px border-b-2 px-3 py-2 text-sm font-bold" :class="tab === t.id ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'" @click="tab = t.id">{{ t.label }}</button>
          </nav>

          <!-- A. choose -->
          <section v-if="tab === 'choose'" class="card mt-4">
            <AnimalLibrary :selected="draft.animalId" :browsing="browsing" :favourites="draft.favourites" :recents="store.settings.recents" :custom-url="customUrl" :has-custom="draft.custom.hasImage && !!customUrl" @browse="browsing = $event" @favourite="fav" @upload="useCustomTile" />
          </section>

          <!-- B. appearance -->
          <section v-else-if="tab === 'appearance'" class="card mt-4 space-y-5">
            <div class="grid gap-3 sm:grid-cols-2">
              <div><label class="label" for="c-name">Pet name</label><input id="c-name" v-model="draft.name" class="input" :maxlength="NAME_MAX" placeholder="e.g. Mochi" /></div>
              <div>
                <span class="label">Accessory</span>
                <div class="flex flex-wrap gap-1.5">
                  <button v-for="a in ACCESSORIES" :key="a.id" class="rounded-full border px-3 py-1 text-xs font-bold" :class="draft.accessory === a.id ? 'border-accent bg-accent text-on-primary' : 'border-line bg-surface text-muted hover:text-ink'" :disabled="isCustom" :aria-pressed="draft.accessory === a.id" @click="draft.accessory = a.id">{{ a.name }}</button>
                </div>
              </div>
            </div>

            <div v-if="isCustom || !animal" class="flex items-start gap-2 rounded-xl bg-bg p-3 text-sm text-muted"><Info class="mt-0.5 h-4 w-4 shrink-0" />Colours and accessories belong to the built-in animals. An uploaded picture keeps its own colours, and you can still set its name and size.</div>
            <div v-else>
              <span class="label">Colours</span>
              <div class="flex flex-wrap gap-1.5" role="tablist" aria-label="Part to colour">
                <button v-for="p in parts" :key="p.key" role="tab" :aria-selected="activePart === p.key" class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold" :class="activePart === p.key ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-muted hover:text-ink'" @click="activePart = p.key">
                  <span class="h-3.5 w-3.5 rounded-full border border-line" :style="{ background: currentColors[p.key] }" />{{ p.label }}
                </button>
              </div>
              <div v-if="parts.some((p) => p.key === activePart)" class="mt-3 rounded-xl border border-line p-3">
                <div class="flex flex-wrap items-center gap-1.5">
                  <button v-for="c in SWATCHES" :key="c" class="h-7 w-7 rounded-full border-2" :class="currentColors[activePart] === c ? 'border-ink' : 'border-line'" :style="{ background: c }" :aria-label="`Use ${c}`" @click="setColor(activePart, c)" />
                  <label class="ml-1 flex items-center gap-2 text-xs font-bold text-muted">Custom <input type="color" class="h-8 w-10 cursor-pointer rounded border border-line bg-surface p-0.5" :value="currentColors[activePart]" :aria-label="`Custom colour for ${activePart}`" @input="setColor(activePart, $event.target.value)" /></label>
                  <button v-if="draft.colors[activePart]" class="btn-ghost ml-auto py-1 text-xs" @click="clearColor(activePart)"><RotateCcw class="h-3.5 w-3.5" />Reset this colour</button>
                </div>
              </div>
              <button class="btn-ghost mt-3" @click="resetAppearanceNow"><RotateCcw class="h-4 w-4" />Reset appearance (colours, accessory, name)</button>
            </div>
          </section>

          <!-- C. upload -->
          <section v-else-if="tab === 'upload'" class="mt-4 space-y-4">
            <p class="flex items-start gap-2 rounded-xl border border-line bg-surface p-3 text-sm text-muted"><Info class="mt-0.5 h-4 w-4 shrink-0" />Pictures stay <b class="text-ink">on this device</b>, in your browser. They are not sent anywhere, so they will not show up on your other computers or phone. Your colours, size and other choices are saved to your account.</p>

            <div class="card">
              <h2 class="h">Your own character</h2>
              <div class="flex flex-wrap items-center gap-4">
                <span class="chequer grid h-24 w-24 place-items-center rounded-xl border border-line"><img v-if="draft.custom.hasImage && customUrl" :src="customUrl" alt="Your character" class="h-24 w-24 object-contain" /><Upload v-else class="h-6 w-6 text-muted" /></span>
                <div class="space-y-2">
                  <input :ref="(el) => (inputs.custom = el)" type="file" :accept="ACCEPT" class="sr-only" @change="onFile($event, 'custom')" />
                  <div class="flex flex-wrap gap-2">
                    <button class="btn-primary" @click="inputs.custom.click()"><Upload class="h-4 w-4" />{{ draft.custom.hasImage ? 'Replace picture' : 'Upload a picture' }}</button>
                    <button v-if="draft.custom.hasImage" class="btn-ghost text-red-600" @click="deleteCustom"><Trash2 class="h-4 w-4" />Delete custom companion</button>
                    <button class="btn-ghost" @click="restoreAnimal"><RotateCcw class="h-4 w-4" />Restore a default companion</button>
                  </div>
                  <p class="text-xs text-muted">PNG, JPG or WebP up to 5 MB. Transparent PNG and WebP keep their see-through background.</p>
                </div>
              </div>
              <p v-if="uploadError.custom" class="mt-3 text-sm font-semibold text-red-600" role="alert">{{ uploadError.custom }}</p>
              <p v-if="customMissing" class="mt-3 flex items-start gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300"><TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />Your picture is not on this device (it was uploaded somewhere else). Upload it again here, or choose an animal. Until then the default cat is shown.</p>
            </div>

            <div class="card">
              <h2 class="h">A photo on the face of a built-in animal</h2>
              <p v-if="isCustom" class="text-sm text-muted">Choose one of the built-in animals first. Face photos are shaped to each animal's own head.</p>
              <template v-else>
                <div class="flex flex-wrap items-center gap-4">
                  <span class="block h-24 w-24 rounded-xl border border-line bg-bg p-1"><CompanionAvatar :animal-id="shownAnimalId" :colors="draft.colors" :accessory="draft.accessory" :face-url="draft.face.hasImage ? faceUrl : ''" :face="draft.face" /></span>
                  <div class="space-y-2">
                    <input :ref="(el) => (inputs.face = el)" type="file" :accept="ACCEPT" class="sr-only" @change="onFile($event, 'face')" />
                    <div class="flex flex-wrap gap-2">
                      <button class="btn-primary" @click="inputs.face.click()"><Upload class="h-4 w-4" />{{ draft.face.hasImage ? 'Replace photo' : 'Upload a photo' }}</button>
                      <button v-if="draft.face.hasImage" class="btn-ghost" @click="removeFace"><RotateCcw class="h-4 w-4" />Restore the original face</button>
                    </div>
                    <p class="text-xs text-muted">The ears, body and tail stay. Only the face area shows your photo.</p>
                  </div>
                </div>
                <div v-if="draft.face.hasImage && faceUrl" class="mt-4 grid gap-3 sm:grid-cols-3">
                  <div><label class="label" for="f-zoom">Zoom: {{ draft.face.zoom.toFixed(2) }}x</label><input id="f-zoom" v-model.number="draft.face.zoom" type="range" min="1" max="3" step="0.05" class="w-full accent-[var(--accent)]" /></div>
                  <div><label class="label" for="f-x">Move left / right</label><input id="f-x" v-model.number="draft.face.x" type="range" min="-1" max="1" step="0.05" class="w-full accent-[var(--accent)]" :disabled="draft.face.zoom <= 1" /></div>
                  <div><label class="label" for="f-y">Move up / down</label><input id="f-y" v-model.number="draft.face.y" type="range" min="-1" max="1" step="0.05" class="w-full accent-[var(--accent)]" :disabled="draft.face.zoom <= 1" /></div>
                  <p v-if="draft.face.zoom <= 1" class="text-xs text-muted sm:col-span-3">Zoom in to move the photo around inside the face.</p>
                </div>
                <p v-if="uploadError.face" class="mt-3 text-sm font-semibold text-red-600" role="alert">{{ uploadError.face }}</p>
                <p v-if="faceMissing" class="mt-3 flex items-start gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300"><TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />Your face photo is not on this device. Upload it again here.</p>
              </template>
            </div>
          </section>

          <!-- D. size and position -->
          <section v-else-if="tab === 'size'" class="card mt-4 space-y-4">
            <div>
              <label class="label" for="c-size">Size: {{ draft.size }} px</label>
              <input id="c-size" v-model.number="draft.size" type="range" :min="SIZE.min" :max="SIZE.max" step="2" class="w-full accent-[var(--accent)]" />
              <div class="mt-3 flex items-end gap-4 rounded-xl bg-bg p-3">
                <span class="block" :style="{ width: draft.size + 'px', height: draft.size + 'px' }"><CompanionAvatar :animal-id="shownAnimalId" :colors="draft.colors" :accessory="draft.accessory" :custom-url="customUrl" :face-url="draft.face.hasImage ? faceUrl : ''" :face="draft.face" :animated="animated" /></span>
                <span class="text-xs text-muted">This is its real size on the screen.</span>
              </div>
            </div>
            <div>
              <span class="label">Position</span>
              <p class="text-sm text-muted">Drag your companion on the screen to place it. It remembers where you put it, stays inside the window, and follows you from page to page.</p>
              <button class="btn-ghost mt-2" @click="resetPositionNow"><RotateCcw class="h-4 w-4" />Reset position</button>
            </div>
          </section>

          <!-- E. behaviour -->
          <section v-else-if="tab === 'behaviour'" class="card mt-4 space-y-3">
            <label class="chk"><input v-model="draft.visible" type="checkbox" />Show my companion on the screen <span class="text-xs font-semibold text-muted">(turn off to hide it for now)</span></label>
            <label class="chk"><input v-model="draft.behaviour.animations" type="checkbox" />Animations (blinking, breathing, tail and ear movement, looking around)</label>
            <label class="chk"><input v-model="draft.behaviour.sleep" type="checkbox" />Fall asleep when I have been away for a minute</label>
            <label class="chk"><input v-model="draft.behaviour.taskReactions" type="checkbox" />React to my tasks (cheer when I finish one, encourage me when I add one, look around when I change board)</label>
            <label class="chk"><input v-model="draft.behaviour.greeting" type="checkbox" />Say hello when I open the app</label>
            <label class="chk"><input v-model="draft.behaviour.peekCats" type="checkbox" />Show the little cats that peek over cards and columns</label>
            <div class="rounded-xl border border-line p-3">
              <label class="chk"><input v-model="draft.behaviour.sounds" type="checkbox" />Animal sounds <span class="text-xs font-semibold text-muted">(off by default; they play when you pat it or finish a task)</span></label>
              <div class="mt-2 flex items-center gap-3">
                <Volume2 class="h-4 w-4 text-muted" /><input v-model.number="draft.behaviour.volume" type="range" min="0" max="100" step="5" class="min-w-0 flex-1 accent-[var(--accent)]" aria-label="Volume" :disabled="!draft.behaviour.sounds" />
                <span class="w-9 text-right text-xs font-bold text-muted">{{ draft.behaviour.volume }}%</span>
                <button class="btn-ghost py-1 text-xs" :disabled="!draft.behaviour.sounds" @click="testSound">Play</button>
              </div>
            </div>
            <p class="text-xs text-muted">If your device is set to reduce motion, or "Reduce motion" is on in Appearance, animations stay off whatever you choose here.</p>
          </section>

          <!-- F. reset -->
          <section v-else class="card mt-4 space-y-3">
            <div v-for="r in [
              { t: 'Reset appearance', d: 'Colours, accessory and name go back to the animal\'s own.', f: resetAppearanceNow, ok: true },
              { t: 'Reset uploaded face', d: 'Removes the photo from the face and restores the original face.', f: removeFace, ok: draft.face.hasImage },
              { t: 'Reset position', d: 'Puts your companion back in its starting corner (applied at once).', f: resetPositionNow, ok: true },
              { t: 'Restore original animal', d: 'Back to the orange tabby cat with its own colours.', f: restoreAnimal, ok: true },
            ]" :key="r.t" class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
              <div><p class="text-sm font-bold">{{ r.t }}</p><p class="text-xs text-muted">{{ r.d }}</p></div>
              <button class="btn-ghost" :disabled="!r.ok" @click="r.f"><RotateCcw class="h-4 w-4" />{{ r.t }}</button>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-300 p-3">
              <div><p class="text-sm font-bold">Reset all companion settings</p><p class="text-xs text-muted">Everything goes back to how it started, and your uploaded pictures on this device are deleted.</p></div>
              <button class="btn-danger" @click="confirmAll = true">Reset all</button>
            </div>
          </section>
        </div>

        <!-- live preview -->
        <aside class="self-start lg:sticky lg:top-0">
          <div class="card">
            <h2 class="h">Live preview</h2>
            <div class="mx-auto h-44 w-44 rounded-2xl border border-line bg-bg p-3">
              <CompanionAvatar :animal-id="shownAnimalId" :colors="colors" :accessory="draft.accessory" :custom-url="customUrl" :face-url="draft.face.hasImage && !previewingOther ? faceUrl : ''" :face="draft.face" :state="previewState" :animated="animated" />
            </div>
            <p class="mt-2 text-center text-sm font-extrabold">{{ draft.name || animal?.name || 'Your companion' }}</p>
            <p v-if="previewingOther" class="text-center text-xs text-muted">Previewing {{ getAnimal(browsing)?.name }}</p>
            <button v-if="previewingOther" class="btn-primary mt-3 w-full" @click="choose"><Check class="h-4 w-4" />Select companion</button>
            <div class="mt-3 flex flex-wrap justify-center gap-1.5">
              <button class="btn-ghost px-2.5 py-1 text-xs" @click="show('happy')">Pat</button>
              <button class="btn-ghost px-2.5 py-1 text-xs" @click="show('celebrate', 2000)">Celebrate</button>
              <button class="btn-ghost px-2.5 py-1 text-xs" @click="show('sleep', 0)">Sleep</button>
              <button class="btn-ghost px-2.5 py-1 text-xs" @click="show('idle', 0)">Wake</button>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <!-- apply / cancel / reset -->
    <div class="sticky bottom-0 z-10 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
        <span class="mr-auto text-xs font-semibold text-muted">{{ dirty ? 'You have changes that are not applied yet.' : 'Everything is saved.' }}</span>
        <button class="btn-ghost" :disabled="!dirty || saving" @click="cancel">Cancel</button>
        <button class="btn-ghost" :disabled="saving" @click="confirmAll = true">Reset to default</button>
        <button class="btn-primary" :disabled="!dirty || saving" @click="apply">{{ saving ? 'Saving…' : 'Apply changes' }}</button>
      </div>
    </div>

    <ImageCropper v-if="cropping" :file="cropping.file" :title="cropping.kind === 'custom' ? 'Crop your character' : 'Crop your face photo'"
      :hint="cropping.kind === 'custom' ? 'Drag to move, zoom to fit. Transparent areas stay transparent.' : 'Centre the face. Your animal will show the middle of this picture.'" :confirm-text="cropping.kind === 'custom' ? 'Use as my companion' : 'Use this photo'"
      @done="cropped" @cancel="cropping = null" />
    <ConfirmDialog v-if="confirmAll" title="Reset all companion settings?" message="Your animal, colours, name, size, behaviour and any pictures saved on this device will go back to the default. This cannot be undone." confirm-text="Reset all" @cancel="confirmAll = false" @confirm="resetEverything" />
  </div>
</template>

<style scoped>
.card { @apply rounded-2xl border border-line bg-surface p-4 shadow-card; }
.h { @apply mb-3 text-sm font-extrabold; }
.chk { @apply flex items-center gap-2 text-sm font-semibold; }
.chk input { accent-color: var(--accent); }
.chequer { background-color: #fff; background-image: linear-gradient(45deg, #d8dcd9 25%, transparent 25%, transparent 75%, #d8dcd9 75%), linear-gradient(45deg, #d8dcd9 25%, transparent 25%, transparent 75%, #d8dcd9 75%); background-size: 12px 12px; background-position: 0 0, 6px 6px; }
</style>
