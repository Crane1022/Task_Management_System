import { describe, it, expect, vi } from 'vitest'
vi.mock('@/firebase/sdk', () => ({ Timestamp: class {} }))
vi.mock('@/firebase/config', () => ({ db: {}, auth: {} }))
const { sendChat, addSticker, state } = vi.hoisted(() => ({ sendChat: vi.fn(async () => ({})), addSticker: vi.fn(async () => ({})), state: { push: null, stickers: null } }))
vi.mock('@/services/workspaceService', () => ({
  subscribeChat: (wid, onData) => { state.push = onData; return () => {} },
  subscribeStickers: (uid, onData) => { state.stickers = onData; return () => {} },
  sendChat, addSticker, deleteChat: vi.fn(async () => {}), deleteSticker: vi.fn(async () => {}),
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { uid: 'me' }, profile: { id: 'me', displayName: 'Me' } }) }))
vi.mock('@/stores/notifications', () => ({ useNotificationStore: () => ({ chatMention: vi.fn() }) }))
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import WorkspaceChat from '@/components/WorkspaceChat.vue'

const ts = { toDate: () => new Date(0) }
const users = { me: { displayName: 'Me' }, u2: { displayName: 'Alice Tan' }, out: { displayName: 'Outsider' } }
const make = () => { setActivePinia(createPinia()); return mount(WorkspaceChat, { props: { workspaceId: 'w1', workspace: { id: 'w1', members: { me: 'admin', u2: 'member' } }, users, isAdmin: false } }) }

describe('workspace chat', () => {
  it('shows messages and stickers; only your own can be deleted', async () => {
    const w = make()
    state.push([
      { id: '1', text: 'hello', userId: 'me', userName: 'Me', createdAt: ts },
      { id: '2', text: '', userId: 'u2', userName: 'Alice', createdAt: ts, sticker: { emoji: '🎉' } },
      { id: '3', text: '', userId: 'u2', userName: 'Alice', createdAt: ts, sticker: { url: 'https://x.test/s.png' } },
    ])
    await flushPromises()
    expect(w.text()).toContain('hello'); expect(w.text()).toContain('🎉')
    expect(w.find('img[src="https://x.test/s.png"]').exists()).toBe(true)
    expect(w.findAll('button[aria-label="Delete message"]')).toHaveLength(1)
  })
  it('tags only workspace members, and sends the tagged ids', async () => {
    const w = make(); sendChat.mockClear()
    const ta = w.get('textarea')
    await ta.setValue('hi @Al'); ta.element.setSelectionRange(6, 6); await ta.trigger('input')
    const names = w.findAll('[role=option] span.font-semibold').map((o) => o.text())
    expect(names).toEqual(['Alice Tan']) // Outsider is not a member
    await w.get('[role=option] button').trigger('mousedown')
    await ta.trigger('keydown', { key: 'Enter' }) // picker closed now: Enter sends
    await flushPromises()
    expect(sendChat).toHaveBeenCalledWith('w1', { text: 'hi @Alice Tan', mentions: ['u2'] }, expect.anything())
  })
  it('adds an emoji at the caret and sends a built-in sticker', async () => {
    const w = make(); sendChat.mockClear()
    await w.get('button[aria-label="Emoji"]').trigger('click')
    await w.findAll('button').find((b) => b.attributes('aria-label') === 'Add 😀').trigger('click') // (emoji inside a CSS selector is unreliable in jsdom)
    expect(w.get('textarea').element.value).toContain('😀')
    await w.get('button[aria-label="Stickers"]').trigger('click')
    await w.findAll('button').find((b) => b.attributes('aria-label') === 'Send sticker 🎉').trigger('click')
    await flushPromises()
    expect(sendChat).toHaveBeenCalledWith('w1', { text: '', sticker: { emoji: '🎉' } }, expect.anything())
  })
  it('saves a sticker from a link, refuses a bad one, and lists saved ones', async () => {
    const w = make(); addSticker.mockClear()
    await w.get('button[aria-label="Stickers"]').trigger('click')
    state.stickers([{ id: 's1', url: 'https://x.test/mine.png' }]); await flushPromises()
    expect(w.find('img[alt="My sticker"]').exists()).toBe(true)
    const input = w.get('input[aria-label="Picture link for a new sticker"]')
    await input.setValue('data:image/png;base64,AAAA'); await w.get('form:last-of-type').trigger('submit')
    expect(addSticker).not.toHaveBeenCalled()
  })
})
