import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const h = vi.hoisted(() => ({ uid: 'u1' }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { uid: h.uid }, profile: { name: 'Ana Lim' } }) }))
vi.mock('@/stores/theme', () => ({ useThemeStore: () => ({ effective: { reduceMotion: false } }) }))
vi.mock('@/services/companionService', () => ({
  subscribeCompanion: vi.fn(() => () => {}),
  saveCompanion: vi.fn(async () => {}),
  patchCompanion: vi.fn(async () => {}),
}))

import CompanionView from '@/views/CompanionView.vue'
import { useCompanionStore } from '@/stores/companion'
import { saveCompanion, patchCompanion } from '@/services/companionService'
import { defaultSettings } from '@/companions/settings'

const settle = async () => { await vi.dynamicImportSettled(); await flushPromises(); await flushPromises() }
const bytes = (arr, pad = 40) => new Uint8Array([...arr, ...new Array(pad).fill(0)])
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const file = (data, name, type) => new File([data], name, { type })
const pick = async (input, f) => { Object.defineProperty(input.element, 'files', { value: [f], configurable: true }); await input.trigger('change'); await settle() }

let wrapper
async function open(uid = 'u1') {
  h.uid = uid
  const pinia = createPinia(); setActivePinia(pinia)
  const store = useCompanionStore(); store.start()
  wrapper = mount(CompanionView, { attachTo: document.body, global: { plugins: [pinia] } })
  await settle()
  return store
}
const tab = async (name) => { await wrapper.findAll('[role=tab]').find((b) => b.text() === name).trigger('click'); await settle() }
const button = (text) => wrapper.findAll('button').find((b) => b.text().includes(text))
const lastSaved = () => saveCompanion.mock.calls.at(-1)[1]

beforeEach(() => {
  localStorage.clear(); saveCompanion.mockClear(); patchCompanion.mockClear()
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
  HTMLElement.prototype.setPointerCapture = vi.fn()
  let n = 0
  URL.createObjectURL = vi.fn(() => `blob:http://test/${++n}`); URL.revokeObjectURL = vi.fn()
  globalThis.createImageBitmap = vi.fn(async () => ({ width: 200, height: 100, close() {} }))
  HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true })
  HTMLCanvasElement.prototype.toBlob = function (cb, type) { cb(new Blob(['x'.repeat(100)], { type })) }
  Blob.prototype.arrayBuffer ??= function () { return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsArrayBuffer(this) }) }
})
afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = '' })

describe('My companion page', () => {
  it('starts on the current companion, and Apply is disabled until something changes', async () => {
    await open()
    expect(button('Apply changes').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Everything is saved.')
    expect(wrapper.text()).toContain('24 animals')
    expect(wrapper.find('button[aria-label="Preview Fox"]').exists()).toBe(true)
  })

  it('search finds the mouse by its Malay name, and categories narrow the list', async () => {
    await open()
    await wrapper.find('input[aria-label="Search animals"]').setValue('tikus'); await settle()
    expect(wrapper.findAll('button[aria-label^="Preview "]').map((b) => b.attributes('aria-label'))).toEqual(['Preview Mouse (Tikus)'])
    await wrapper.find('input[aria-label="Search animals"]').setValue('')
    await wrapper.findAll('[role=tab]').find((b) => b.text() === 'Original cats').trigger('click'); await settle()
    expect(wrapper.findAll('button[aria-label^="Preview "]').length).toBe(5)
  })

  it('previewing an animal changes nothing until "Select companion", then Apply saves it', async () => {
    const store = await open()
    await wrapper.find('button[aria-label="Preview Fox"]').trigger('click'); await settle()
    expect(wrapper.text()).toContain('Previewing Fox')
    expect(button('Apply changes').attributes('disabled')).toBeDefined() // only previewing
    await button('Select companion').trigger('click'); await settle()
    expect(button('Apply changes').attributes('disabled')).toBeUndefined()
    expect(store.settings.animalId).toBe('cat-orange') // not applied yet
    await button('Apply changes').trigger('click'); await settle()
    expect(store.settings.animalId).toBe('fox')
    expect(lastSaved().animalId).toBe('fox')
    expect(lastSaved().recents[0]).toBe('fox')
  })

  it('favourites are saved', async () => {
    const store = await open()
    await wrapper.find('button[aria-label="Add Dog to favourites"]').trigger('click'); await settle()
    await button('Apply changes').trigger('click'); await settle()
    expect(store.settings.favourites).toEqual(['dog'])
    await wrapper.findAll('[role=tab]').find((b) => b.text() === 'Favourites').trigger('click'); await settle()
    expect(wrapper.findAll('button[aria-label^="Preview "]').map((b) => b.attributes('aria-label'))).toEqual(['Preview Dog'])
  })

  it('changing colours, the name and an accessory is saved; one colour and the whole look can be reset', async () => {
    const store = await open()
    await tab('Appearance')
    await wrapper.find('input#c-name').setValue('Mochi')
    await wrapper.find('button[aria-label="Use #e63946"]').trigger('click')
    await button('Crown').trigger('click'); await settle()
    await button('Apply changes').trigger('click'); await settle()
    expect(store.settings).toMatchObject({ name: 'Mochi', accessory: 'crown', colors: { body: '#e63946' } })
    await button('Reset this colour').trigger('click'); await settle()
    await button('Apply changes').trigger('click'); await settle()
    expect(store.settings.colors).toEqual({})
    await button('Reset appearance').trigger('click'); await settle()
    await button('Apply changes').trigger('click'); await settle()
    expect(store.settings).toMatchObject({ name: '', accessory: 'none' })
  })

  it('Cancel throws the changes away', async () => {
    const store = await open()
    await tab('Appearance')
    await wrapper.find('input#c-name').setValue('Temporary')
    await button('Cancel').trigger('click'); await settle()
    expect(wrapper.find('input#c-name').element.value).toBe('')
    expect(store.settings.name).toBe('')
    expect(saveCompanion).not.toHaveBeenCalled()
  })

  it('size and behaviour settings are saved, including hiding the companion and turning sounds on', async () => {
    const store = await open()
    await tab('Size and position')
    await wrapper.find('input#c-size').setValue('140')
    await tab('Behaviour')
    const box = (label) => wrapper.findAll('label.chk').find((l) => l.text().includes(label)).find('input')
    await box('Show my companion').setValue(false)
    await box('Animal sounds').setValue(true)
    await box('Show the little cats').setValue(false)
    await button('Apply changes').trigger('click'); await settle()
    expect(store.settings).toMatchObject({ size: 140, visible: false })
    expect(store.settings.behaviour).toMatchObject({ sounds: true, peekCats: false, animations: true })
  })

  it('"Reset position" puts it back at once and saves the starting place', async () => {
    const store = await open()
    store.setPosition({ x: 0.1, y: 0.1 }); patchCompanion.mockClear()
    await tab('Size and position')
    await button('Reset position').trigger('click'); await settle()
    expect(store.settings.position).toEqual({ x: 0.9, y: 0.8 })
    await new Promise((r) => setTimeout(r, 800)) // the saved copy follows a moment later
    expect(patchCompanion).toHaveBeenCalledWith('u1', { position: { x: 0.9, y: 0.8 } })
  })
})

describe('uploading your own pictures', () => {
  it('rejects unsupported, oversized, renamed and damaged files with a clear message', async () => {
    await open(); await tab('Upload')
    const input = wrapper.findAll('input[type=file]')[0]
    await pick(input, file(bytes([0x47, 0x49, 0x46, 0x38]), 'pet.gif', 'image/gif'))
    expect(wrapper.text()).toContain('PNG, JPG or WebP')
    await pick(input, file(new Uint8Array(5 * 1024 * 1024 + 10), 'huge.png', 'image/png'))
    expect(wrapper.text()).toMatch(/limit is 5 MB/)
    await pick(input, file(bytes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 'broken.png', 'image/png'))
    expect(wrapper.text()).toContain('does not look like a real picture')
    expect(wrapper.find('[role=dialog][aria-label="Crop your character"]').exists()).toBe(false)
  })

  it('a valid picture opens the cropper; using it makes it the companion, and Apply keeps it on this device', async () => {
    const store = await open(); await tab('Upload')
    await pick(wrapper.findAll('input[type=file]')[0], file(PNG, 'me.png', 'image/png'))
    expect(wrapper.find('[role=dialog][aria-label="Crop your character"]').exists()).toBe(true)
    await button('Use as my companion').trigger('click'); await settle()
    expect(wrapper.find('[role=dialog][aria-label="Crop your character"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Delete custom companion')
    await button('Apply changes').trigger('click'); await settle()
    expect(store.settings.animalId).toBe('custom')
    expect(store.settings.custom.hasImage).toBe(true)
    expect(store.urls.custom).toMatch(/^blob:/)
    expect(JSON.stringify(lastSaved())).not.toMatch(/blob:|data:image|base64/) // no picture data in the Firestore document
  })

  it('delete custom companion, and restore a default one', async () => {
    const store = await open(); await tab('Upload')
    await pick(wrapper.findAll('input[type=file]')[0], file(PNG, 'me.png', 'image/png'))
    await button('Use as my companion').trigger('click'); await settle()
    await button('Apply changes').trigger('click'); await settle()
    await button('Delete custom companion').trigger('click'); await settle()
    await button('Apply changes').trigger('click'); await settle()
    expect(store.settings).toMatchObject({ animalId: 'cat-orange', custom: { hasImage: false } })
    expect(store.urls.custom).toBe('')
    await store.save({ ...store.settings, animalId: 'bear' }); await settle()
    await button('Restore a default companion').trigger('click'); await settle()
    await button('Apply changes').trigger('click'); await settle()
    expect(store.settings.animalId).toBe('cat-orange')
  })

  it('a face photo is stored for a built-in animal, its zoom is saved, and the original face can be restored', async () => {
    const store = await open()
    await wrapper.find('button[aria-label="Preview Panda"]').trigger('click'); await button('Select companion').trigger('click')
    await tab('Upload')
    await pick(wrapper.findAll('input[type=file]')[1], file(PNG, 'face.png', 'image/png'))
    await button('Use this photo').trigger('click'); await settle()
    await wrapper.find('input#f-zoom').setValue('2')
    await button('Apply changes').trigger('click'); await settle()
    expect(store.settings.animalId).toBe('panda')
    expect(store.settings.face).toMatchObject({ hasImage: true, zoom: 2 })
    expect(store.urls.face).toMatch(/^blob:/)
    await button('Restore the original face').trigger('click'); await settle()
    await button('Apply changes').trigger('click'); await settle()
    expect(store.settings.face).toMatchObject({ hasImage: false, zoom: 1 })
    expect(store.urls.face).toBe('')
  })

  it('a picture that cannot be opened shows a friendly error instead of breaking', async () => {
    await open(); await tab('Upload')
    globalThis.createImageBitmap = vi.fn(async () => { throw new Error('decode failed') })
    await pick(wrapper.findAll('input[type=file]')[0], file(PNG, 'me.png', 'image/png'))
    expect(wrapper.text()).toContain('could not be opened')
  })
})

describe('saving, restoring and per-person settings', () => {
  it('survive a page reload (this device) and a sign-in on another device (Firestore)', async () => {
    const store = await open()
    await wrapper.find('button[aria-label="Preview Bunny"]').trigger('click'); await button('Select companion').trigger('click')
    await tab('Appearance'); await wrapper.find('input#c-name').setValue('Biscuit')
    await button('Apply changes').trigger('click'); await settle()
    wrapper.unmount()
    // a reload: a fresh app on the same device
    const again = await open()
    expect(again.settings).toMatchObject({ animalId: 'bunny', name: 'Biscuit' })
    // another device: nothing local, but Firestore has the document
    localStorage.clear()
    const { subscribeCompanion } = await import('@/services/companionService')
    subscribeCompanion.mockImplementationOnce((uid, cb) => { cb(lastSaved() ? JSON.parse(JSON.stringify(lastSaved())) : null); return () => {} })
    wrapper.unmount()
    const other = await open()
    expect(other.settings).toMatchObject({ animalId: 'bunny', name: 'Biscuit' })
  })

  it('a different person on the same computer gets their own pet, never the previous person\'s', async () => {
    const store = await open('anna')
    await wrapper.find('button[aria-label="Preview Fox"]').trigger('click'); await button('Select companion').trigger('click')
    await button('Apply changes').trigger('click'); await settle()
    expect(store.settings.animalId).toBe('fox')
    store.stop()
    expect(store.settings).toEqual(defaultSettings()) // signing out wipes it from memory
    wrapper.unmount()
    const ben = await open('ben')
    expect(ben.settings.animalId).toBe('cat-orange')
    expect(ben.urls.custom).toBe('')
    const anna = await open('anna')
    expect(anna.settings.animalId).toBe('fox') // and Anna's is still hers
  })

  it('"Reset all" asks first, then restores everything and clears the pictures', async () => {
    const store = await open(); await tab('Upload')
    await pick(wrapper.findAll('input[type=file]')[0], file(PNG, 'me.png', 'image/png'))
    await button('Use as my companion').trigger('click'); await settle()
    await button('Apply changes').trigger('click'); await settle()
    await tab('Reset')
    await button('Reset all').trigger('click'); await settle()
    expect(wrapper.text()).toContain('Reset all companion settings?') // the confirmation
    expect(store.settings.animalId).toBe('custom') // nothing happened yet
    const dialog = wrapper.find('[role=alertdialog]')
    await dialog.findAll('button').find((b) => b.text() === 'Reset all').trigger('click'); await settle()
    expect(store.settings).toEqual(defaultSettings())
    expect(store.urls.custom).toBe('')
    expect(lastSaved()).toMatchObject({ animalId: 'cat-orange', custom: { hasImage: false } })
  })
})
