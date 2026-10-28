import test from 'node:test'
import assert from 'node:assert/strict'
import { planReminders, startOfDay, DAY } from '../api/_lib/deadlines.js'
import handler from '../api/deadline-reminders.js'
import { setServicesForTest } from '../api/_lib/pms.js'

// "now" = 10:00 on 10 Oct 2026 in UTC+8, so today starts at 2026-10-09T16:00Z
const NOW = new Date('2026-10-10T02:00:00Z')
const TODAY = startOfDay(NOW, 8)
const task = (id, offsetDays, extra = {}) => ({ id, title: `T${id}`, boardId: 'main', dueDate: new Date(TODAY.getTime() + offsetDays * DAY), assignedTo: ['a'], completedAt: null, ...extra })

test('startOfDay is midnight in the office time zone', () => {
  assert.equal(TODAY.toISOString(), '2026-10-09T16:00:00.000Z')
})

test('overdue, due today, due tomorrow are reminded; later and completed are not', () => {
  const plan = planReminders([task('1', -1), task('2', 0), task('3', 1), task('4', 2), task('5', -3, { completedAt: {} })], NOW, 8)
  assert.deepEqual(plan.map((p) => `${p.id}`), ['deadline_overdue_1', 'deadline_soon_2', 'deadline_soon_3'])
  assert.match(plan[1].data.title, /today/); assert.match(plan[2].data.title, /tomorrow/)
})

test('everyone assigned gets one, and a task nobody has is skipped', () => {
  const plan = planReminders([task('1', 0, { assignedTo: ['a', 'b', 'a'] }), task('2', 0, { assignedTo: [] }), task('3', 0, { dueDate: null })], NOW, 8)
  assert.deepEqual(plan.map((p) => p.uid), ['a', 'b'])
})

// ----- the endpoint, with a fake database -----
function fakeDb(taskDocs) {
  const notifications = new Map()
  return {
    notifications,
    collection(name) {
      if (name === 'tasks') return { where: () => ({ get: async () => ({ docs: taskDocs.map(([id, x]) => ({ id, data: () => x })) }) }) }
      return { doc: (uid) => ({ collection: () => ({ doc: (id) => ({ create: async (data) => {
        const key = `${uid}/${id}`
        if (notifications.has(key)) throw Object.assign(new Error('ALREADY_EXISTS'), { code: 6 })
        notifications.set(key, data)
      } }) }) }) }
    },
  }
}
const ts = (d) => ({ toDate: () => d })
const call = async (headers) => {
  let status, body
  await handler({ method: 'GET', headers, query: {} }, { setHeader() {}, status(s) { status = s; return this }, json(b) { body = b }, end() {} })
  return { status, body }
}

test('endpoint: needs the secret, creates once, never twice', async () => {
  process.env.CRON_SECRET = 's3cret'
  const db = fakeDb([['t1', { title: 'A', boardId: 'main', dueDate: ts(new Date(TODAY.getTime() - DAY)), assignedTo: ['u1'], completedAt: null }]])
  setServicesForTest({ db, Timestamp: { fromDate: (d) => d }, FieldValue: { serverTimestamp: () => 'NOW' } })
  assert.equal((await call({})).status, 401)
  assert.equal((await call({ authorization: 'Bearer wrong!' })).status, 401)
  const first = await call({ authorization: 'Bearer s3cret' })
  assert.equal(first.status, 200); assert.equal(first.body.created, 1)
  assert.equal(db.notifications.get('u1/deadline_overdue_t1').read, false)
  const again = await call({ authorization: 'Bearer s3cret' })
  assert.equal(again.body.created, 0, 'a second run adds nothing')
  delete process.env.CRON_SECRET
  assert.equal((await call({ authorization: 'Bearer s3cret' })).status, 500, 'no secret configured = refuses')
})
