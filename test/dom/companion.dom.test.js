import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

// the real components and the real companion store; only Firebase and the other stores are replaced
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { uid: 'u1' }, profile: { name: 'Ana Lim', displayName: '' } }) }))
vi.mock('@/stores/theme', () => ({ useThemeStore: () => ({ effective: { reduceMotion: false } }) }))
vi.mock('@/services/companionService', () => ({
  subscribeCompanion: vi.fn(() => () => {}),
  saveCompanion: vi.fn(async () => {}),
  patchCompanion: vi.fn(async () => {}),
}))

import PetCompanion from '@/components/PetCompanion.vue'
import CompanionAvatar from '@/components/CompanionAvatar.vue'
import { useCompanionStore } from '@/stores/companion'
import { patchCompanion } from '@/services/companionService'
import { MESSAGES } from '@/companions/behaviour'

const settle = async () => { await vi.dynamicImportSettled(); await flushPromises(); await flushPromises() }
const size = (w, h) => { Object.defineProperty(window, 'innerWidth', { value: w, configurable: true }); Object.defineProperty(window, 'innerHeight', { value: h, configurable: true }) }
const mq = (reduced) => { window.matchMedia = (q) => ({ matches: reduced && q.includes('reduce'), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) }
const ptr = (type, x, y, target) => { const e = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true }); Object.defineProperty(e, 'pointerId', { value: 1 }); target.dispatchEvent(e) }
const px = (el, prop) => parseFloat(el.style[prop])

let wrapper
async function mountPet() {
  const pinia = createPinia(); setActivePinia(pinia)
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }, { path: '/settings/companion', component: { render: () => null } }] })
  const store = useCompanionStore()
  store.start()
  wrapper = mount(PetCompanion, { attachTo: document.body, global: { plugins: [pinia, router] } })
  await settle()
  return { store, router, pet: () => wrapper.find('.pet').element }
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.setItem('wb-pet-hello', '1') // no greeting unless a test wants it
  HTMLElement.prototype.setPointerCapture = vi.fn(); HTMLElement.prototype.releasePointerCapture = vi.fn()
  size(1000, 700); mq(false); patchCompanion.mockClear()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.useRealTimers(); document.body.innerHTML = '' })

describe('the roaming companion', () => {
  it('appears at its saved place, inside the window, at the saved size', async () => {
    const { pet } = await mountPet()
    expect(px(pet(), 'left')).toBe(852); expect(px(pet(), 'top')).toBe(512); expect(px(pet(), 'width')).toBe(96)
  })

  it('is not shown at all when hidden', async () => {
    const { store } = await mountPet()
    await store.setVisible(false); await settle()
    expect(wrapper.find('.pet-layer').exists()).toBe(false)
    await store.setVisible(true); await settle()
    expect(wrapper.find('.pet').exists()).toBe(true)
  })

  it('can be dragged, stays in the window, and the place is saved ONCE after the drag ends', async () => {
    const { store, pet } = await mountPet()
    ptr('pointerdown', 900, 560, pet())
    ptr('pointermove', 700, 400, pet()); ptr('pointermove', 500, 300, pet())
    await settle()
    expect(px(pet(), 'left')).toBe(452); expect(px(pet(), 'top')).toBe(252) // followed the pointer
    expect(patchCompanion).not.toHaveBeenCalled() // nothing is written while moving
    ptr('pointerup', 500, 300, pet())
    await settle()
    expect(store.settings.position.x).toBeCloseTo(0.5, 3); expect(store.settings.position.y).toBeCloseTo(0.4286, 3)
    expect(JSON.parse(localStorage.getItem('wb-companion:u1')).position.x).toBeCloseTo(0.5, 3) // remembered on this device at once
    vi.advanceTimersByTime(700)
    expect(patchCompanion).toHaveBeenCalledTimes(1)
    expect(patchCompanion.mock.calls[0][0]).toBe('u1')
  })

  it('several quick drags become one write', async () => {
    const { pet } = await mountPet()
    for (const [x, y] of [[300, 300], [400, 350], [500, 400]]) { ptr('pointerdown', 900, 560, pet()); ptr('pointermove', x, y, pet()); ptr('pointerup', x, y, pet()); await settle(); vi.advanceTimersByTime(200) }
    vi.advanceTimersByTime(800)
    expect(patchCompanion).toHaveBeenCalledTimes(1)
  })

  it('cannot be dragged off the screen', async () => {
    const { pet } = await mountPet()
    ptr('pointerdown', 900, 560, pet()); ptr('pointermove', 5000, -5000, pet()); await settle()
    expect(px(pet(), 'left')).toBe(1000 - 96 - 8); expect(px(pet(), 'top')).toBe(8)
    ptr('pointermove', -5000, 9000, pet()); await settle()
    expect(px(pet(), 'left')).toBe(8); expect(px(pet(), 'top')).toBe(700 - 96 - 8)
    ptr('pointerup', 0, 0, pet())
  })

  it('a click without moving pets it (a bubble, no move, nothing saved)', async () => {
    const { pet } = await mountPet()
    ptr('pointerdown', 900, 560, pet()); ptr('pointerup', 900, 560, pet()); await settle()
    expect(MESSAGES.pet).toContain(wrapper.find('.pet-bubble').text())
    expect(px(pet(), 'left')).toBe(852)
    vi.advanceTimersByTime(1000)
    expect(patchCompanion).not.toHaveBeenCalled()
    expect(wrapper.find('.pet-root').classes()).toContain('pet-jump')
  })

  it('is recalculated when the window is resized, and never ends up off-screen', async () => {
    vi.useRealTimers()
    const { pet } = await mountPet()
    size(400, 600); window.dispatchEvent(new Event('resize')); await new Promise((r) => setTimeout(r, 50)); await settle()
    const left = px(pet(), 'left'), top = px(pet(), 'top'), w = px(pet(), 'width')
    expect(left).toBeGreaterThanOrEqual(8); expect(left + w).toBeLessThanOrEqual(400 - 8)
    expect(top + w).toBeLessThanOrEqual(600 - 8)
    expect(w).toBeLessThanOrEqual(400 * 0.4) // and it was made smaller to fit a small screen
    size(1000, 700); window.dispatchEvent(new Event('resize')); await new Promise((r) => setTimeout(r, 50)); await settle()
    expect(px(pet(), 'left')).toBe(852) // the saved place comes back when the window grows again
  })

  it('"Hide" in its little toolbar hides it and saves that', async () => {
    const { pet, store } = await mountPet()
    ptr('pointerdown', 900, 560, pet()); ptr('pointerup', 900, 560, pet()); await settle()
    await wrapper.find('button[title="Hide my companion for now"]').trigger('click'); await settle()
    expect(store.settings.visible).toBe(false)
    expect(patchCompanion).toHaveBeenCalledWith('u1', { visible: false })
    expect(wrapper.find('.pet').exists()).toBe(false)
  })

  it('animations follow the setting and the reduced-motion preference', async () => {
    let { store } = await mountPet()
    expect(wrapper.find('.pet-root').classes()).toContain('pet-anim')
    store.settings = { ...store.settings, behaviour: { ...store.settings.behaviour, animations: false } }; await settle()
    expect(wrapper.find('.pet-root').classes()).not.toContain('pet-anim')
    wrapper.unmount()
    mq(true) // the device asks for reduced motion
    await mountPet()
    expect(wrapper.find('.pet-root').classes()).not.toContain('pet-anim')
  })

  it('falls asleep when idle and wakes on the next click or key', async () => {
    await mountPet()
    vi.advanceTimersByTime(59_000); await settle()
    expect(wrapper.find('.pet-root').classes()).not.toContain('pet-sleep')
    vi.advanceTimersByTime(1500); await settle()
    expect(wrapper.find('.pet-root').classes()).toContain('pet-sleep')
    window.dispatchEvent(new Event('pointerdown')); await settle()
    expect(wrapper.find('.pet-root').classes()).not.toContain('pet-sleep')
  })

  it('does not fall asleep when that is switched off', async () => {
    const { store } = await mountPet()
    store.settings = { ...store.settings, behaviour: { ...store.settings.behaviour, sleep: false } }
    window.dispatchEvent(new Event('keydown')); await settle()
    vi.advanceTimersByTime(120_000); await settle()
    expect(wrapper.find('.pet-root').classes()).not.toContain('pet-sleep')
  })

  it('celebrates a finished task, cheers a new one, and stays quiet when task reactions are off', async () => {
    const { store } = await mountPet()
    store.react('completed'); await settle()
    expect(MESSAGES.completed).toContain(wrapper.find('.pet-bubble').text())
    expect(wrapper.find('.pet-confetti').exists()).toBe(true)
    expect(wrapper.find('.pet-root').classes()).toContain('pet-celebrate')
    vi.advanceTimersByTime(4000); await settle()
    store.react('created'); await settle()
    expect(MESSAGES.created).toContain(wrapper.find('.pet-bubble').text())
    vi.advanceTimersByTime(4000); await settle()
    store.settings = { ...store.settings, behaviour: { ...store.settings.behaviour, taskReactions: false } }
    store.react('completed'); await settle()
    expect(wrapper.find('.pet-bubble').exists()).toBe(false)
  })

  it('says hello once per session, if the person wants it', async () => {
    sessionStorage.removeItem('wb-pet-hello')
    await mountPet()
    vi.advanceTimersByTime(1600); await settle()
    expect(wrapper.find('.pet-bubble').text()).toBe('mew! Hi Ana!')
    wrapper.unmount()
    await mountPet() // a second page load in the same session: no second hello
    vi.advanceTimersByTime(1600); await settle()
    expect(wrapper.find('.pet-bubble').exists()).toBe(false)
  })

  it('is invisible to the keyboard and to screen readers', async () => {
    await mountPet()
    expect(wrapper.find('.pet-layer').attributes('aria-hidden')).toBe('true')
    expect(wrapper.findAll('[tabindex]:not([tabindex="-1"])').length).toBe(0)
  })
})

describe('the drawn companion', () => {
  const avatar = async (props) => { const w = mount(CompanionAvatar, { props }); await settle(); return w }

  it('draws a built-in animal with its own colours, and applies the person\'s colour changes', async () => {
    const w = await avatar({ animalId: 'dog' })
    expect(w.find('svg.pet-svg').exists()).toBe(true)
    expect(w.find('svg').attributes('style')).toContain('--c-body: #c58f5a')
    await w.setProps({ colors: { body: '#00ff00' } })
    expect(w.find('svg').attributes('style')).toContain('--c-body: #00ff00')
    expect(w.find('svg').attributes('style')).toContain('--c-ear: #8a5a33') // the other parts are untouched
  })

  it('switches between animals', async () => {
    const w = await avatar({ animalId: 'dog' })
    const dog = w.find('svg').html()
    await w.setProps({ animalId: 'bunny' }); await settle()
    const bunny = w.find('svg').html()
    expect(bunny).not.toBe(dog)
    expect(bunny).toContain('rotate(-8 38 19)') // the bunny's tall ears
    await w.setProps({ animalId: 'cat-calico' }); await settle()
    expect(w.find('svg').attributes('style')).toContain('--c-tail: #4a4540')
  })

  it('shows an uploaded character as a picture, and falls back to the default cat if it is not on this device', async () => {
    const w = await avatar({ animalId: 'custom', customUrl: 'blob:http://x/me' })
    expect(w.find('img.pet-raster').attributes('src')).toBe('blob:http://x/me')
    await w.setProps({ customUrl: '' }); await settle()
    expect(w.find('img').exists()).toBe(false)
    expect(w.find('svg.pet-svg').exists()).toBe(true)
  })

  it('shows a face photo inside the animal\'s own head and refuses a picture address it did not make', async () => {
    const w = await avatar({ animalId: 'panda', faceUrl: 'blob:http://x/face', face: { zoom: 1.5, x: 0, y: 0 } })
    expect(w.find('svg image').exists()).toBe(true)
    expect(w.find('svg clipPath').exists()).toBe(true)
    await w.setProps({ faceUrl: 'https://evil.example/x.png' }); await settle()
    expect(w.find('svg image').exists()).toBe(false)
  })

  it('has the idle animation classes only when animated, and the mood classes', async () => {
    const w = await avatar({ animalId: 'cat-orange', animated: false })
    expect(w.find('.pet-root').classes()).not.toContain('pet-anim')
    await w.setProps({ animated: true, state: 'happy', look: 'l' })
    expect(w.find('.pet-root').classes()).toEqual(expect.arrayContaining(['pet-anim', 'pet-happy', 'pet-look-l']))
  })
})
