import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeBoard, timeAgo } from '../src/utils/boardStats.js'

const ts = (iso) => ({ toDate: () => new Date(iso) }) // looks like a Firestore Timestamp
const NOW = new Date('2026-10-22T10:00:00')

test('counts total, completed and overdue tasks', () => {
  const columns = [{ id: 'c1', name: 'TODO' }, { id: 'c2', name: 'DONE' }, { id: 'c3', name: 'OLD', archived: true }]
  const tasks = [
    { columnId: 'c1', dueDate: ts('2026-10-20T00:00:00') },                          // overdue
    { columnId: 'c1', dueDate: ts('2026-10-22T00:00:00') },                          // due today: not overdue yet
    { columnId: 'c1', dueDate: ts('2026-10-30T00:00:00') },                          // later
    { columnId: 'c1' },                                                              // no due date
    { columnId: 'c2', completedAt: ts('2026-10-21T00:00:00'), dueDate: ts('2026-10-01T00:00:00') }, // done: never overdue
  ]
  const s = summarizeBoard(columns, tasks, NOW)
  assert.equal(s.total, 5)
  assert.equal(s.done, 1)
  assert.equal(s.overdue, 1)
  assert.deepEqual(s.columns.map((c) => [c.name, c.count]), [['TODO', 4], ['DONE', 1]]) // archived columns are not shown
})
test('an empty board', () => {
  assert.deepEqual(summarizeBoard([], [], NOW), { total: 0, done: 0, overdue: 0, columns: [] })
})
test('timeAgo', () => {
  assert.equal(timeAgo(null, NOW), 'just now')
  assert.equal(timeAgo(new Date('2026-10-22T09:55:00'), NOW), '5 min ago')
  assert.equal(timeAgo(new Date('2026-10-22T07:00:00'), NOW), '3 h ago')
  assert.equal(timeAgo(new Date('2026-10-19T10:00:00'), NOW), '3 days ago')
})
