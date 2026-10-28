import test from 'node:test'
import assert from 'node:assert/strict'
import { statusKey, columnByStatus, mainColumnFor, mergeTasks, unplaced, ownColumnFor, workspaceOfTask, destinations, MAIN_BOARD } from '../src/utils/aggregate.js'
import { effectiveBoardRole, workspaceRoleFor } from '../src/utils/permissions.js'

const mainCols = [{ id: 'm1', name: 'NEW PROJECT' }, { id: 'm2', name: 'TODO' }, { id: 'm3', name: 'DOING' }, { id: 'm4', name: 'DONE' }]
const itCols = [{ id: 'i1', name: 'Backlog' }, { id: 'i2', name: 'Todo' }, { id: 'i3', name: 'Done' }]

test('a task from a workspace board shows in the Main column with the same name as its status', () => {
  assert.equal(statusKey(' todo '), 'TODO')
  assert.equal(columnByStatus(mainCols, 'todo').id, 'm2')
  assert.equal(mainColumnFor({ boardId: 'main', columnId: 'm3', status: 'DOING' }, mainCols).id, 'm3') // Main's own task: by column
  assert.equal(mainColumnFor({ boardId: 'B1', columnId: 'i2', status: 'TODO' }, mainCols).id, 'm2') // other board: by status name
  assert.equal(mainColumnFor({ boardId: 'B1', columnId: 'i1', status: 'BACKLOG' }, mainCols), null)
})

test('tasks that fit no Main column are listed, not lost', () => {
  const tasks = [{ id: 1, boardId: 'B1', status: 'TODO' }, { id: 2, boardId: 'B1', status: 'BACKLOG' }, { id: 3, boardId: 'main', columnId: 'm1' }]
  assert.deepEqual(unplaced(tasks, mainCols).map((t) => t.id), [2])
})

test('the same task arriving twice is one task (no duplicates on the Main Board)', () => {
  const a = { id: 't1', title: 'A' }, b = { id: 't2', title: 'B' }
  const merged = mergeTasks([a, b], [{ id: 't1', title: 'A (again)' }], [b])
  assert.deepEqual(merged.map((t) => t.id), ['t1', 't2'])
  assert.equal(merged[0].title, 'A')
})

test('dropping a workspace task into a Main column moves it to the same-named column of ITS board, or says there is none', () => {
  assert.equal(ownColumnFor(mainCols[1], itCols).id, 'i2')
  assert.equal(ownColumnFor(mainCols[2], itCols), null) // DOING does not exist on that board
})

test('a task\'s workspace is the stored one, or comes from its board', () => {
  const boards = { B1: { workspaceId: 'W1' } }
  assert.equal(workspaceOfTask({ boardId: 'B1' }, (id) => boards[id]), 'W1')
  assert.equal(workspaceOfTask({ boardId: 'B1', workspaceId: 'W9' }, (id) => boards[id]), 'W9')
  assert.equal(workspaceOfTask({ boardId: 'main' }, (id) => boards[id]), null)
})

test('"where should the task go" lists only boards the person may add tasks to', () => {
  const workspaces = [{ id: 'W1', name: 'IT' }, { id: 'W2', name: 'HR' }, { id: 'W3', name: 'Old', archived: true }]
  const boardsByWs = { W1: [{ id: 'B1', name: 'Support' }, { id: 'B2', name: 'Web', archived: true }], W2: [{ id: 'B3', name: 'Hiring' }], W3: [{ id: 'B4', name: 'x' }] }
  const roleOf = (w, b) => ({ B1: 'member', B3: 'viewer', B4: 'admin', B2: 'admin' })[b.id] ?? 'none'
  const list = destinations({ workspaces, boardsByWs, roleOf })
  assert.deepEqual(list.map((d) => d.value), [MAIN_BOARD, 'B1']) // viewer board, archived board and archived workspace are left out
  assert.equal(list[1].workspaceId, 'W1')
  assert.equal(list[1].label, 'IT › Support')
  assert.deepEqual(destinations({ workspaces, boardsByWs, roleOf, includeMain: false }).map((d) => d.value), ['B1'])
})

test('Super Private: a Director, manager or admin gets NO access from their job; the owner and invited members do', () => {
  const open = { superPrivate: false, members: { ana: 'member' } }
  const secret = { superPrivate: true, members: { owner: 'admin', ana: 'member', vic: 'viewer' } }
  assert.equal(workspaceRoleFor(open, 'dir', true), 'admin') // a normal workspace: a Director is still admin
  assert.equal(workspaceRoleFor(secret, 'dir', true), 'none') // a Super Private one: not even a Director
  assert.equal(workspaceRoleFor(secret, 'owner', false), 'admin')
  assert.equal(workspaceRoleFor(secret, 'ana', false), 'member')
  assert.equal(workspaceRoleFor(secret, 'vic', false), 'viewer')
  assert.equal(workspaceRoleFor(secret, 'mgr', false), 'none') // a manager who was not invited
  assert.equal(workspaceRoleFor({ members: {} }, 'dir', true), 'admin') // an existing workspace (no flag at all) stays as it was
  // and on the board level
  assert.equal(effectiveBoardRole({ isDirector: true, workspaceRole: 'none', workspacePrivate: true }), 'none')
  assert.equal(effectiveBoardRole({ isDirector: true, workspaceRole: 'none', workspacePrivate: false }), 'admin')
  assert.equal(effectiveBoardRole({ isDirector: true, workspaceRole: 'admin', workspacePrivate: true }), 'admin') // a Director who IS the owner
  assert.equal(effectiveBoardRole({ isDirector: false, workspaceRole: 'none', workspacePrivate: true, boardOverride: 'admin' }), 'none')
})
