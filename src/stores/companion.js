import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from './auth'
import { useUiStore } from './ui'
import { subscribeCompanion, saveCompanion, patchCompanion } from '@/services/companionService'
import { createImageStore, indexedDbKv } from '@/companions/imageStore'
import { readCache, writeCache } from '@/companions/localCache'
import { defaultSettings, normalizeSettings, rememberRecent, resetAll, DEFAULT_POSITION } from '@/companions/settings'
import { pickMessage, reactionAllowed } from '@/companions/behaviour'
import { CUSTOM_ID, getAnimal } from '@/companions/registry'

// The signed-in person's virtual pet: settings (synced through Firestore), pictures (kept on this device),
// and the little events (a task was completed, ...) the pet reacts to.
export const useCompanionStore = defineStore('companion', () => {
  const auth = useAuthStore()
  const ui = useUiStore()
  const images = createImageStore(indexedDbKv())

  const settings = ref(defaultSettings())
  const urls = ref({ custom: '', face: '' }) // blob: addresses of this person's pictures on this device
  const loaded = ref(false)
  const reaction = ref(null) // { id, type, text }
  let uid = ''
  let unsub = null
  let posTimer = null
  let seq = 0

  const animal = computed(() => getAnimal(settings.value.animalId))
  const customMissing = computed(() => settings.value.animalId === CUSTOM_ID && !urls.value.custom)
  const faceMissing = computed(() => settings.value.face.hasImage && !urls.value.face)

  // ----- pictures on this device -----
  async function loadImage(kind) {
    const old = urls.value[kind]
    let next = ''
    if (settings.value[kind === 'custom' ? 'custom' : 'face'].hasImage) {
      const blob = await images.get(uid, kind)
      if (blob) next = URL.createObjectURL(blob)
    }
    urls.value = { ...urls.value, [kind]: next }
    if (old) URL.revokeObjectURL(old)
  }
  const loadImages = () => Promise.all([loadImage('custom'), loadImage('face')])

  function apply(next) {
    const stamps = `${next.custom.stamp}|${next.face.stamp}|${next.custom.hasImage}|${next.face.hasImage}`
    const prev = `${settings.value.custom.stamp}|${settings.value.face.stamp}|${settings.value.custom.hasImage}|${settings.value.face.hasImage}`
    settings.value = next
    if (stamps !== prev || !loaded.value) loadImages()
  }

  function start() {
    stop()
    uid = auth.user.uid
    const cached = readCache(uid)
    apply(cached ?? defaultSettings())
    unsub = subscribeCompanion(uid, (remote) => {
      loaded.value = true
      if (remote) { apply(remote); writeCache(uid, remote) }
    }, (e) => { loaded.value = true; console.warn('Companion settings could not be loaded', e.code) })
  }
  function stop() {
    unsub?.(); unsub = null
    clearTimeout(posTimer)
    Object.values(urls.value).forEach((u) => u && URL.revokeObjectURL(u))
    urls.value = { custom: '', face: '' }
    settings.value = defaultSettings() // nothing of the previous person stays in memory
    loaded.value = false; uid = ''
  }

  // ----- saving -----
  // `pending` = { custom, face }: a Blob to store, null to delete, undefined to leave as it is
  async function save(draft, pending = {}) {
    if (!uid) return false
    try {
      const next = normalizeSettings(rememberRecent(draft, draft.animalId))
      for (const kind of ['custom', 'face']) {
        const p = pending[kind]
        if (p === undefined) continue
        const key = kind === 'custom' ? 'custom' : 'face'
        if (p === null) { await images.del(uid, kind); next[key].hasImage = false }
        else { await images.put(uid, kind, p); next[key].hasImage = true }
        next[key].stamp = Date.now()
      }
      await saveCompanion(uid, next)
      writeCache(uid, next)
      apply(next)
      return true
    } catch (e) {
      console.error(e)
      ui.toast(`Could not save your companion: ${e.code ?? e.message}`, 'error')
      return false
    }
  }

  // Everything back to how a new person starts, and the pictures on this device are deleted
  async function resetEverything() {
    if (!uid) return false
    try {
      await images.clear(uid)
      const fresh = resetAll()
      await saveCompanion(uid, fresh)
      writeCache(uid, fresh)
      apply(fresh)
      return true
    } catch (e) {
      ui.toast(`Could not reset: ${e.code ?? e.message}`, 'error')
      return false
    }
  }

  // Position is saved when a drag ENDS (never while moving), and a few quick drags become one write
  function setPosition(pos) {
    settings.value = { ...settings.value, position: { x: pos.x, y: pos.y } }
    if (!uid) return
    writeCache(uid, settings.value)
    clearTimeout(posTimer)
    const id = uid
    posTimer = setTimeout(() => patchCompanion(id, { position: settings.value.position }).catch(() => {}), 700)
  }
  const resetPosition = () => setPosition({ ...DEFAULT_POSITION })
  async function setVisible(visible) {
    settings.value = { ...settings.value, visible }
    if (!uid) return
    writeCache(uid, settings.value)
    try { await patchCompanion(uid, { visible }) } catch { ui.toast('Could not save that change', 'error') }
  }

  // ----- reactions -----
  function react(type) {
    if (!reactionAllowed(settings.value, type)) return
    reaction.value = { id: ++seq, type, text: pickMessage(type) }
  }
  // changing board makes the pet look around
  watch(() => ui.activeBoardId, () => react('board'))

  return { settings, urls, loaded, reaction, animal, customMissing, faceMissing, start, stop, save, resetEverything, setPosition, resetPosition, setVisible, react }
})
