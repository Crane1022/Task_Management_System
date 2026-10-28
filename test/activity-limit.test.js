import test from 'node:test'
import assert from 'node:assert/strict'
import { ACTIVITY_LIMIT, slotOf, activityId, isSlotId, newest, staleLegacy, summarize } from '../src/utils/activity.js'

test('a task can only ever have 15 activity records: the 16th takes the oldest one\'s place', () => {
  assert.equal(ACTIVITY_LIMIT, 15)
  const ids = new Set()
  for (let seq = 1; seq <= 1000; seq++) ids.add(activityId('T1', seq))
  assert.equal(ids.size, 15) // however many activities happen, there are only 15 possible documents
  assert.equal(activityId('T1', 1), 'T1_0')
  assert.equal(activityId('T1', 15), 'T1_14')
  assert.equal(activityId('T1', 16), 'T1_0') // overwrites record 1
  assert.equal(activityId('T1', 31), 'T1_0')
  assert.equal(slotOf(2), 1)
})

test('each task has its own 15 records', () => {
  assert.notEqual(activityId('A', 1), activityId('B', 1))
  assert.equal(new Set([...Array(40)].map((_, i) => activityId('A', i + 1)).concat([...Array(40)].map((_, i) => activityId('B', i + 1)))).size, 30)
})

test('only slot IDs count as numbered records; old random IDs do not', () => {
  assert.ok(isSlotId('abc123_0') && isSlotId('abc123_14'))
  for (const bad of ['abc123_15', 'abc123_-1', 'abc123', 'a_b_3', 'abc123_', '_3', 'Xk93jf02lsKd8s7aPq1z']) assert.equal(isSlotId(bad), false, bad)
})

test('the newest record is shown first, and never more than 15', () => {
  const list = Array.from({ length: 22 }, (_, i) => ({ id: `r${i}`, createdAt: { seconds: 1000 + i } }))
  const shown = newest(list)
  assert.equal(shown.length, 15)
  assert.equal(shown[0].id, 'r21')
  assert.equal(shown[14].id, 'r7')
  assert.ok(shown.every((a, i) => i === 0 || shown[i - 1].createdAt.seconds >= a.createdAt.seconds))
})

test('a record the server has not confirmed yet appears on top, ties are broken by the counter', () => {
  const list = [{ id: 'a', createdAt: { seconds: 5 }, seq: 1 }, { id: 'b', createdAt: null, seq: 3 }, { id: 'c', createdAt: { seconds: 5 }, seq: 2 }]
  assert.deepEqual(newest(list).map((a) => a.id), ['b', 'c', 'a'])
})

test('old records beyond the newest 15 are found, so they can be deleted; records inside the limit are kept', () => {
  const legacy = Array.from({ length: 20 }, (_, i) => ({ id: `Xk93jf02lsKd8s7aP${String(i).padStart(3, '0')}`, createdAt: { seconds: 100 + i } }))
  const slot = Array.from({ length: 3 }, (_, i) => ({ id: `T_${i}`, seq: i + 1, createdAt: { seconds: 500 + i } }))
  const stale = staleLegacy([...legacy, ...slot])
  assert.equal(stale.length, 8) // 23 records; the newest 15 are 3 slot records + the 12 newest old ones
  assert.ok(stale.every((a) => !isSlotId(a.id)))
  assert.ok(stale.every((a) => a.createdAt.seconds < 108))
  assert.deepEqual(staleLegacy(slot), []) // numbered records are never deleted this way
})

test('several changes saved together become one record', () => {
  assert.equal(summarize(['changed priority', '', 'changed due date']), 'changed priority; changed due date')
  assert.equal(summarize([]), '')
})
