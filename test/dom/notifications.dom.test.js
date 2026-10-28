import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/firebase/sdk', () => ({ Timestamp: class {} }))
vi.mock('@/firebase/config', () => ({ db: {}, auth: {} }))
const sent = []
let push
vi.mock('@/services/notificationService', () => ({
  subscribeNotifications: (uid, onData) => { push = onData; return () => {} },
  sendNotifications: async (items) => { sent.push(...items) },
  markRead: vi.fn(async () => {}), markAllRead: vi.fn(async () => {}), removeMany: vi.fn(async () => {}), surplus: () => [],
}))
vi.mock('@/services/taskService', () => ({
  subscribeComments: (id, onData) => { onData([]); return () => {} },
  addComment: vi.fn(async () => ({})), editComment: vi.fn(), deleteComment: vi.fn(),
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { uid: 'me' }, profile: { id: 'me', displayName: 'Me', role: 'employee', departmentId: 'it' } }) }))
vi.mock('@/stores/workspace', () => ({ useWorkspaceStore: () => ({ workspaceById: () => null }) }))
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import NotificationBell from '@/components/NotificationBell.vue'
import TaskComments from '@/components/TaskComments.vue'
import { useNotificationStore } from '@/stores/notifications'
import { addComment } from '@/services/taskService'

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<i/>' } }] })
const ts = (s) => ({ seconds: s, toDate: () => new Date(s * 1000) })
beforeEach(() => { setActivePinia(createPinia()); sent.length = 0 })

describe('the bell', () => {
  it('shows the unread count and opens the task on click', async () => {
    const w = mount(NotificationBell, { global: { plugins: [router] } })
    push([
      { id: 'a', type: 'mention', title: 'Ana mentioned you in a comment', body: 'hi', taskId: 't1', boardId: 'main', read: false, createdAt: ts(5) },
      { id: 'b', type: 'workspace_added', title: 'Ana added you to a workspace', workspaceId: 'w1', read: true, createdAt: ts(4) },
    ])
    await flushPromises()
    expect(w.get('button').text()).toBe('1')
    await w.get('button').trigger('click')
    expect(w.text()).toContain('Ana mentioned you in a comment')
    await w.findAll('li button')[0].trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/b/main?task=t1')
  })
  it('says when there is nothing', async () => {
    const w = mount(NotificationBell, { global: { plugins: [router] } })
    push([]); await flushPromises()
    await w.get('button').trigger('click')
    expect(w.text()).toContain('all caught up')
  })
})

describe('tagging in a comment', () => {
  const users = { me: { displayName: 'Me', role: 'employee', departmentId: 'it' }, u2: { displayName: 'Alice Tan', role: 'employee', departmentId: 'it' }, u3: { displayName: 'Bob', role: 'employee', departmentId: 'hr' } }
  const task = { id: 't1', title: 'Fix', boardId: 'main', departmentId: 'it', assignedTo: ['u2'], createdBy: 'me' }
  it('typing @ offers people who can open the task; picking one tags them and notifies them', async () => {
    const w = mount(TaskComments, { props: { taskId: 't1', users, canComment: true, task }, global: { plugins: [router] }, attachTo: document.body })
    useNotificationStore() // same pinia
    const ta = w.get('textarea')
    await ta.setValue('thanks @Al')
    ta.element.setSelectionRange(10, 10)
    await ta.trigger('input')
    const options = w.findAll('[role=option]')
    expect(options.map((o) => o.get('span.font-semibold').text())).toEqual(['Alice Tan']) // Bob is in another department: cannot open this task
    await options[0].find('button').trigger('mousedown')
    expect(ta.element.value).toBe('thanks @Alice Tan ')
    await w.get('button[aria-label="Post comment"]').trigger('click')
    await flushPromises()
    expect(addComment).toHaveBeenCalledWith('t1', 'thanks @Alice Tan', expect.anything(), ['u2'])
    expect(sent.map((s) => [s.uid, s.data.type])).toEqual([['u2', 'mention']]) // the mention replaces the plain "comment" notice
    w.unmount()
  })
})
