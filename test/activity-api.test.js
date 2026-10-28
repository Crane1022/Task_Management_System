import test from 'node:test'
import assert from 'node:assert/strict'
import { addActivities, activityId as apiId, slotOf as apiSlot, ACTIVITY_LIMIT as apiLimit } from '../api/_lib/activity.js'
import { activityId as webId, slotOf as webSlot, ACTIVITY_LIMIT as webLimit, isSlotId } from '../src/utils/activity.js'

// a tiny stand-in for the Firestore Admin batch
function fake() {
  const docs = new Map()
  const db = { collection: (c) => ({ doc: (id) => ({ path: `${c}/${id}` }) }) }
  const FieldValue = { serverTimestamp: () => 'SERVER_TIME' }
  const batch = { set: (ref, data) => docs.set(ref.path, data) }
  return { db, FieldValue, batch, docs }
}
const me = { uid: 'u1', name: 'Ana' }

test('the server and the web app put activity records in exactly the same places', () => {
  assert.equal(apiLimit, 15)
  assert.equal(webLimit, apiLimit)
  for (let seq = 1; seq <= 200; seq++) { assert.equal(apiId('T9', seq), webId('T9', seq)); assert.equal(apiSlot(seq), webSlot(seq)) }
  for (let seq = 1; seq <= 60; seq++) assert.ok(isSlotId(apiId('abc123', seq)))
})

test('the server continues a task\'s numbering and never writes more than 15 records for it', () => {
  const { db, FieldValue, batch, docs } = fake()
  // 40 activities, saved in separate batches the way real requests arrive, each continuing from the task's counter
  let counter = 0
  for (let i = 0; i < 40; i++) counter = addActivities(db, FieldValue, batch, 'T1', counter, me, [['updated', `change ${i + 1}`]])
  assert.equal(counter, 40)
  assert.equal(docs.size, 15) // only 15 records exist
  const newest = [...docs.values()].sort((a, b) => b.seq - a.seq)
  assert.equal(newest[0].detail, 'change 40')
  assert.equal(newest[14].detail, 'change 26') // the oldest 25 were overwritten
  assert.ok([...docs.keys()].every((k) => /^task_activities\/T1_([0-9]|1[0-4])$/.test(k)))
})

test('several changes in one request get consecutive numbers, a missing counter starts at 1', () => {
  const { db, FieldValue, batch, docs } = fake()
  const seq = addActivities(db, FieldValue, batch, 'T2', undefined, me, [['commented', 'a'], ['updated', 'b'], ['moved', 'c']])
  assert.equal(seq, 3)
  assert.deepEqual([...docs.values()].map((d) => d.seq), [1, 2, 3])
  assert.equal(docs.get('task_activities/T2_0').action, 'commented')
  assert.equal(docs.get('task_activities/T2_0').createdAt, 'SERVER_TIME')
})

test('every task has its own 15, and one task\'s history never touches another\'s', () => {
  const { db, FieldValue, batch, docs } = fake()
  let a = 0, b = 0
  for (let i = 0; i < 20; i++) { a = addActivities(db, FieldValue, batch, 'A', a, me, [['x', '']]); b = addActivities(db, FieldValue, batch, 'B', b, me, [['y', '']]) }
  assert.equal(docs.size, 30)
  assert.equal([...docs.keys()].filter((k) => k.includes('/A_')).length, 15)
})
