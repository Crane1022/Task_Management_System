import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNotification, canSeeTask, taskAudience, unreadCount, newestFirst } from '../src/utils/notifications.js'

const by = { id: 'u1', displayName: 'Ana' }

test('buildNotification only uses the keys firestore.rules allows', () => {
  const n = buildNotification('assigned', by, { task: { id: 't1', title: 'Fix it', boardId: 'main', workspaceId: 'w1' } })
  assert.deepEqual(Object.keys(n).sort(), ['boardId', 'body', 'byId', 'byName', 'read', 'taskId', 'title', 'type', 'workspaceId'])
  assert.equal(n.read, false)
  assert.equal(n.byId, 'u1')
  assert.equal(n.taskId, 't1')
  assert.match(n.title, /Ana assigned you a task/)
})

test('long text is clipped to the rule limits', () => {
  const n = buildNotification('comment', by, { task: { id: 't', title: 'x' }, body: 'y'.repeat(500) })
  assert.ok(n.body.length <= 200 && n.title.length <= 150)
})

test('a workspace notification links to the workspace, not a task', () => {
  const n = buildNotification('workspace_added', by, { workspace: { id: 'w9', name: 'Sales' } })
  assert.equal(n.workspaceId, 'w9'); assert.equal(n.taskId, ''); assert.equal(n.body, 'Sales')
})

test('taskAudience: assignees and creator, never the actor, never twice', () => {
  const t = { assignedTo: ['a', 'b', 'u1'], createdBy: 'a' }
  assert.deepEqual(taskAudience(t, 'u1'), ['a', 'b'])
  assert.deepEqual(taskAudience(t, 'u1', ['b']), ['a'], 'people already told (mentioned) are skipped')
  assert.deepEqual(taskAudience({ assignedTo: [] }, 'u1'), [])
})

test('canSeeTask follows the workspace members, and Super Private blocks Directors', () => {
  const ws = { members: { m1: 'member' }, superPrivate: false }
  const task = { workspaceId: 'w1', departmentId: 'it', assignedTo: [] }
  assert.equal(canSeeTask({ id: 'm1', role: 'employee' }, task, ws), true)
  assert.equal(canSeeTask({ id: 'x', role: 'employee' }, task, ws), false)
  assert.equal(canSeeTask({ id: 'd', role: 'super_admin' }, task, ws), true)
  assert.equal(canSeeTask({ id: 'd', role: 'super_admin' }, task, { ...ws, superPrivate: true }), false)
  assert.equal(canSeeTask({ id: 'x', role: 'employee' }, task, null), true, 'workspace unknown from here: do not guess')
})

test('canSeeTask on the original board uses department or assignment', () => {
  const task = { departmentId: 'it', assignedTo: ['z'] }
  assert.equal(canSeeTask({ id: 'a', departmentId: 'it', role: 'employee' }, task, null), true)
  assert.equal(canSeeTask({ id: 'z', departmentId: 'hr', role: 'employee' }, task, null), true)
  assert.equal(canSeeTask({ id: 'q', departmentId: 'hr', role: 'employee' }, task, null), false)
  assert.equal(canSeeTask(undefined, task, null), false)
})

test('unreadCount and newestFirst', () => {
  assert.equal(unreadCount([{ read: false }, { read: true }, {}]), 2)
  const list = newestFirst([{ id: 'a', createdAt: { seconds: 1 } }, { id: 'b', createdAt: { seconds: 5 } }, { id: 'c' }])
  assert.deepEqual(list.map((n) => n.id), ['c', 'b', 'a'], 'a just-written one (no server time yet) is newest')
})
