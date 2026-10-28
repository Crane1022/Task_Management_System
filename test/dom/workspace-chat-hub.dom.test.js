import { describe, it, expect, vi } from 'vitest'
vi.mock('@/firebase/sdk', () => ({ Timestamp: class {} }))
vi.mock('@/firebase/config', () => ({ db: {}, auth: {} }))
const h = vi.hoisted(() => ({ createChat: vi.fn(async (w, d, u, id) => id || 'newgroup'), updateChat: vi.fn(async () => {}), state: { chats: null } }))
vi.mock('@/services/workspaceService', () => ({
  subscribeChats: (wid, uid, onData) => { h.state.chats = onData; return () => {} },
  subscribeChat: (wid, cid, onData) => { onData([]); return () => {} },
  subscribeStickers: (uid, onData) => { onData([]); return () => {} },
  createChat: h.createChat, updateChat: h.updateChat, deleteConversation: vi.fn(async () => {}),
  sendChat: vi.fn(), deleteMessage: vi.fn(), addSticker: vi.fn(), deleteSticker: vi.fn(),
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { uid: 'me' }, profile: { id: 'me', displayName: 'Me' } }) }))
vi.mock('@/stores/notifications', () => ({ useNotificationStore: () => ({ chatMention: vi.fn() }) }))
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import WorkspaceChatHub from '@/components/WorkspaceChatHub.vue'

const users = { me: { displayName: 'Me' }, u2: { displayName: 'Alice Tan' }, u3: { displayName: 'Bob' } }
const workspace = { id: 'w1', members: { me: 'admin', u2: 'member', u3: 'member' } }
const make = () => { setActivePinia(createPinia()); return mount(WorkspaceChatHub, { props: { workspace, users, isAdmin: true } }) }
const btn = (w, label) => w.findAll('button').find((b) => b.attributes('aria-label') === label)

describe('chat hub', () => {
  it('lists groups and DMs, showing the other person for a DM', async () => {
    const w = make()
    h.state.chats([{ id: 'g1', type: 'group', name: 'Design', memberIds: ['me', 'u2'], createdBy: 'me' }, { id: 'dm_me_u3', type: 'dm', memberIds: ['me', 'u3'], createdBy: 'u3' }])
    await flushPromises()
    const nav = w.get('nav').text()
    expect(nav).toContain('Everyone'); expect(nav).toContain('Design'); expect(nav).toContain('Bob')
  })
  it('creates a group with the people picked (and me)', async () => {
    const w = make(); h.createChat.mockClear()
    await btn(w, 'New group').trigger('click')
    await w.get('input[aria-label="Group name"]').setValue('Sales team')
    await w.findAll('input[type=checkbox]')[0].setValue(true) // Alice Tan
    await w.findAll('button').find((b) => b.text() === 'Create group').trigger('click')
    await flushPromises()
    expect(h.createChat).toHaveBeenCalledWith('w1', { type: 'group', name: 'Sales team', memberIds: ['me', 'u2'] }, expect.anything())
  })
  it('refuses a group with nobody else in it', async () => {
    const w = make(); h.createChat.mockClear()
    await btn(w, 'New group').trigger('click')
    await w.get('input[aria-label="Group name"]').setValue('Alone')
    await w.findAll('button').find((b) => b.text() === 'Create group').trigger('click')
    expect(h.createChat).not.toHaveBeenCalled()
  })
  it('starts a DM with a fixed id, and reopens the same one next time', async () => {
    const w = make(); h.createChat.mockClear()
    h.state.chats([]); await flushPromises()
    await btn(w, 'New message').trigger('click')
    await w.findAll('li button').find((b) => b.text().includes('Bob')).trigger('click')
    await flushPromises()
    expect(h.createChat).toHaveBeenCalledWith('w1', { type: 'dm', memberIds: ['me', 'u3'] }, expect.anything(), 'dm_me_u3')
    h.createChat.mockClear()
    h.state.chats([{ id: 'dm_me_u3', type: 'dm', memberIds: ['me', 'u3'], createdBy: 'me' }]); await flushPromises()
    await btn(w, 'New message').trigger('click')
    await w.findAll('li button').find((b) => b.text().includes('Bob')).trigger('click')
    expect(h.createChat).not.toHaveBeenCalled()
  })
})
