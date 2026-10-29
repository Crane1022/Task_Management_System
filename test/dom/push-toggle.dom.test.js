import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/firebase/sdk', () => ({}))
vi.mock('@/firebase/config', () => ({ db: {}, app: {} }))
const h = vi.hoisted(() => ({ on: false, possible: true, perm: 'default', enablePush: vi.fn(async () => {}), disablePush: vi.fn(async () => {}), runPushTest: vi.fn(async () => [{ ok: true, text: 'Fine.' }, { ok: false, text: 'The server function /api/send-push was not found.' }]) }))
vi.mock('@/services/pushService', () => ({
  pushPossible: () => h.possible, pushPermission: () => h.perm, pushIsOn: async () => h.on, enablePush: h.enablePush, disablePush: h.disablePush, runPushTest: h.runPushTest,
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { uid: 'me' } }) }))
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PushToggle from '@/components/PushToggle.vue'

beforeEach(() => { setActivePinia(createPinia()); h.on = false; h.possible = true; h.perm = 'default'; h.enablePush.mockClear(); h.disablePush.mockClear() })

describe('desktop pop-ups switch', () => {
  it('turns on from a click, and off again', async () => {
    const w = mount(PushToggle); await flushPromises()
    const sw = w.get('[role=switch]')
    expect(sw.attributes('aria-checked')).toBe('false')
    await sw.trigger('click'); await flushPromises()
    expect(h.enablePush).toHaveBeenCalledWith('me'); expect(sw.attributes('aria-checked')).toBe('true')
    await sw.trigger('click'); await flushPromises()
    expect(h.disablePush).toHaveBeenCalledWith('me'); expect(sw.attributes('aria-checked')).toBe('false')
  })
  it('starts on when this browser is already set up', async () => {
    h.on = true
    const w = mount(PushToggle); await flushPromises()
    expect(w.get('[role=switch]').attributes('aria-checked')).toBe('true')
  })
  it('stays off and explains when the browser refuses', async () => {
    h.enablePush.mockRejectedValueOnce(Object.assign(new Error('Pop-ups are blocked for this site.'), { code: 'push/denied' }))
    h.perm = 'denied'
    const w = mount(PushToggle); await flushPromises()
    expect(w.text()).toContain('Blocked in this browser')
    await w.get('[role=switch]').trigger('click'); await flushPromises()
    expect(w.get('[role=switch]').attributes('aria-checked')).toBe('false')
  })
  it('the test button lists each step and marks the one that failed', async () => {
    const w = mount(PushToggle); await flushPromises()
    await w.findAll('button').find((b) => b.text() === 'Send test pop-up').trigger('click'); await flushPromises()
    const lines = w.findAll('li').map((l) => l.text())
    expect(lines[0]).toContain('✓'); expect(lines[1]).toContain('✗'); expect(lines[1]).toContain('/api/send-push')
  })
  it('is hidden in a browser that cannot do it', async () => {
    h.possible = false
    expect(mount(PushToggle).find('[role=switch]').exists()).toBe(false)
  })
})
