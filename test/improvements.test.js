import test from 'node:test'
import assert from 'node:assert/strict'
import { friendly, friendlySentence, codeOf } from '../src/utils/errors.js'
import { blockersOf, openBlockers, holdingUp, canFinish, makesLoop, waitingMessage } from '../src/utils/deps.js'
import { monthGrid, weekDays, dayKey, parseDay, mondayOf, byDueDay } from '../src/utils/calendar.js'
import { splitHits, snippet, searchAll, fileHits } from '../src/utils/search.js'

test('error codes become sentences people understand', () => {
  assert.match(friendly({ code: 'permission-denied' }), /don’t have permission/)
  assert.match(friendly({ code: 'firestore/unavailable' }), /internet/)
  assert.match(friendly({ code: 'auth/network-request-failed' }), /internet/)
  assert.equal(codeOf({ code: 'firestore/not-found' }), 'not-found')
  assert.equal(friendly(new Error('That link is already attached.')), 'That link is already attached') // our own words are kept
  assert.match(friendly(new Error('FirebaseError: [code=internal] boom')), /something went wrong/) // raw text is not shown
  assert.match(friendlySentence({ code: 'aborted' }), /^Someone else changed it.*\.$/)
})

const done = { toMillis: () => 1 }
const T = (id, extra = {}) => ({ id, title: id.toUpperCase(), ...extra })

test('dependencies: waiting on, holding up, and when a task may be finished', () => {
  const all = [T('a', { blockedBy: ['b', 'c', 'gone'] }), T('b', { completedAt: done }), T('c'), T('d', { blockedBy: ['a'] })]
  assert.deepEqual(blockersOf(all[0], all).map((b) => [b.id, b.done, !!b.task]), [['b', true, true], ['c', false, true], ['gone', false, false]])
  assert.deepEqual(openBlockers(all[0], all).map((b) => b.id), ['c']) // a task nobody can see never blocks
  assert.deepEqual(holdingUp(all[0], all).map((t) => t.id), ['d'])
  assert.equal(canFinish(all[0], all), false)
  assert.equal(canFinish(all[2], all), true)
  assert.match(waitingMessage(all[0], all), /waiting on “C”/)
  assert.equal(makesLoop('c', 'd', all), true) // d waits on a, which waits on c
  assert.equal(makesLoop('c', 'b', all), false)
  assert.equal(makesLoop('a', 'a', all), true)
})

test('calendar: whole weeks from Monday, and tasks grouped by their deadline day', () => {
  const nov = monthGrid(2026, 10) // November 2026 starts on a Sunday
  assert.equal(nov.length % 7, 0)
  assert.equal(nov[0].key, '2026-10-26') // the Monday before
  assert.equal(nov.find((d) => d.inMonth).key, '2026-11-01')
  assert.equal(nov[nov.length - 1].date.getDay(), 0) // ends on a Sunday
  assert.equal(weekDays(parseDay('2026-11-26'))[0].key, '2026-11-23')
  assert.equal(dayKey(mondayOf(parseDay('2026-11-29'))), '2026-11-23')
  const ts = (s) => ({ toDate: () => parseDay(s) })
  const g = byDueDay([{ id: 1, dueDate: ts('2026-11-26') }, { id: 2, dueDate: ts('2026-11-26') }, { id: 3 }])
  assert.deepEqual(Object.keys(g), ['2026-11-26'])
  assert.equal(g['2026-11-26'].length, 2)
})

test('search: matches are highlighted and found in tasks, comments and file names', () => {
  assert.deepEqual(splitHits('Fix Voucher payment', 'voucher'), [{ t: 'Fix ', hit: false }, { t: 'Voucher', hit: true }, { t: ' payment', hit: false }])
  assert.deepEqual(splitHits('abc', ''), [{ t: 'abc', hit: false }])
  assert.match(snippet('x '.repeat(100) + 'voucher total is zero', 'voucher', 40), /^….*voucher/)
  const tasks = [
    { id: 't1', title: 'Fix voucher payment', attachments: [{ id: 'f', name: 'voucher-error.jpg' }] },
    { id: 't2', title: 'Year-end banner', attachments: [] },
  ]
  const comments = { t2: [{ id: 'c1', text: 'Need the voucher code before Friday' }] }
  const r = searchAll(tasks, comments, 'VOUCHER')
  assert.deepEqual(r.tasks.map((t) => t.id), ['t1'])
  assert.deepEqual(r.comments.map((c) => c.task.id), ['t2'])
  assert.deepEqual(r.files.map((f) => f.file.name), ['voucher-error.jpg'])
  assert.equal(fileHits(tasks[0], 'zzz').length, 0)
})

test('search: a colleague’s name finds the person and the tasks assigned to them', async () => {
  const { searchAll, personHit, assigneeHit } = await import('../src/utils/search.js')
  const users = { crane: { id: 'crane', name: 'Neo Ka Hoong', displayName: 'Crane' }, ivan: { id: 'ivan', name: 'Ivan Chong' } }
  const tasks = [{ id: 'a', title: 'Room planner', assignedTo: ['crane'] }, { id: 'b', title: 'Aircon', assignedTo: ['ivan'] }, { id: 'c', title: 'Done one', assignedTo: ['crane'], completedAt: 1 }]
  assert.ok(personHit(users.crane, 'NEO'))
  assert.ok(personHit(users.crane, 'crane'))
  assert.ok(assigneeHit(tasks[0], users, 'neo'))
  const r = searchAll(tasks, {}, 'neo', 8, users)
  assert.deepEqual(r.people.map((p) => [p.user.id, p.count]), [['crane', 1]]) // open tasks only
  assert.deepEqual(r.tasks.map((t) => t.id), ['a', 'c'])
})
