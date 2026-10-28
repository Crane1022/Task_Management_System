// Runs the /api handlers against an in-memory Firestore, fake token checks and a fake PMS REST API.
// npm test   (no Firebase project or network needed; placeholder data only)
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { setServicesForTest } from '../api/_lib/pms.js'
import loginHandler from '../api/pms-login.js'
import taskHandler from '../api/pms-task.js'
import backfillHandler from '../api/workspace-backfill.js'

process.env.ALLOWED_ORIGINS = 'https://pms.example.test, http://localhost:5173'

// ----- fakes -----
const TS = { __ts: true }, DEL = { __del: true }
const ts = (d = new Date()) => ({ toDate: () => d })
const apply = (base, data) => {
  const out = { ...base }
  for (const [k, v] of Object.entries(data)) { if (v === DEL) delete out[k]; else out[k] = v === TS ? ts() : v }
  return out
}
function fakeDb() {
  const store = {} // 'col/id' -> data
  let n = 0
  const docRef = (col, id = `auto${++n}`) => ({
    id, path: `${col}/${id}`,
    async get() { const d = store[`${col}/${id}`]; return { exists: !!d, id, data: () => d } },
    async set(data) { store[`${col}/${id}`] = apply({}, data) },
    async update(data) { if (!store[`${col}/${id}`]) throw new Error('NOT_FOUND'); store[`${col}/${id}`] = apply(store[`${col}/${id}`], data) },
  })
  const q = (col, filters = [], lim = Infinity) => ({
    where: (f, op, v) => q(col, [...filters, [f, op, v]], lim),
    limit: (l) => q(col, filters, l),
    async get() {
      const docs = Object.entries(store).filter(([k]) => k.split('/')[0] === col)
        .map(([k, d]) => ({ id: k.split('/')[1], data: () => d }))
        .filter((d) => filters.every(([f, op, v]) => op === '==' && d.data()[f] === v)).slice(0, lim)
      return { docs }
    },
  })
  return {
    store,
    collection: (col) => ({ doc: (id) => docRef(col, id), ...q(col) }),
    batch() {
      const ops = []
      return { set: (r, d) => ops.push(() => r.set(d)), update: (r, d) => ops.push(() => r.update(d)), commit: async () => { for (const o of ops) await o() } }
    },
  }
}
// PMS staff and their tokens
const PMS_USERS = {
  dirUid: { role: 'director', active: true, displayName: 'Dina Director', email: 'dina@example.test' },
  opsUid: { role: 'operations', active: true, displayName: 'Omar Ops', email: 'omar@example.test' },
  offUid: { role: 'hr', active: false, displayName: 'Old Staff' },
  noRoleUid: { active: true, displayName: 'No Role' },
  procUid: { role: 'procurement', active: true, displayName: 'Pat Procurement', email: 'pat@example.test' },
}
const TOKENS = { 'tok-dir': 'dirUid', 'tok-ops': 'opsUid', 'tok-off': 'offUid', 'tok-norole': 'noRoleUid', 'tok-proc': 'procUid' }
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'boolean' ? { booleanValue: v } : { stringValue: v }]))
async function fakeFetch(url, { headers }) {
  const uid = url.split('/users/')[1]
  const caller = TOKENS[headers.Authorization.replace('Bearer ', '')]
  const allowed = caller === uid || PMS_USERS[caller]?.role === 'director' // like the PMS rules
  if (!allowed || !PMS_USERS[uid]) return { ok: false, json: async () => ({}) }
  return { ok: true, json: async () => ({ fields: fields(PMS_USERS[uid]) }) }
}

let db
beforeEach(() => {
  db = fakeDb()
  // the board: columns as seedDefaultColumns makes them
  ;['NEW PROJECT', 'TODO', 'DOING', 'REVIEW', 'DONE'].forEach((name, i) => {
    db.store[`columns/col${i}`] = { boardId: 'main', name, position: (i + 1) * 1000, isDone: name === 'DONE', archived: false }
  })
  setServicesForTest({
    db, fetch: fakeFetch,
    FieldValue: { serverTimestamp: () => TS, delete: () => DEL },
    Timestamp: { fromDate: ts },
    pmsAuth: { verifyIdToken: async (t) => { if (!TOKENS[t]) throw new Error('bad'); return { uid: TOKENS[t], email: PMS_USERS[TOKENS[t]].email } } },
    tmsAuth: { createCustomToken: async (uid, claims) => `custom:${uid}:${claims.pmsRole}`, verifyIdToken: async (t) => { if (!t.startsWith('tms-')) throw new Error('bad'); return { uid: t.slice(4) } } },
  })
})

function call(handler, { token, body = {}, origin = 'https://pms.example.test', method = 'POST', host = 'tasks.example.test' } = {}) {
  return new Promise((resolve) => {
    const res = {
      headers: {}, code: 200,
      setHeader(k, v) { this.headers[k] = v },
      status(c) { this.code = c; return this },
      json(b) { resolve({ status: this.code, body: b, headers: this.headers }) },
      end() { resolve({ status: this.code, body: null, headers: this.headers }) },
    }
    const headers = { host, ...(origin && { origin }), ...(token && { authorization: `Bearer ${token}` }) }
    handler({ method, headers, body }, res)
  })
}
const task = (body) => call(taskHandler, { token: 'tok-dir', body })

// ----- CORS -----
test('refuses unknown origins and answers preflight for allowed ones', async () => {
  assert.equal((await call(loginHandler, { token: 'tok-dir', origin: 'https://evil.test' })).status, 403)
  assert.equal((await call(loginHandler, { token: 'tok-dir', origin: null })).status, 403)
  const pre = await call(taskHandler, { method: 'OPTIONS', origin: 'http://localhost:5173' })
  assert.equal(pre.status, 204)
  assert.equal(pre.headers['Access-Control-Allow-Origin'], 'http://localhost:5173')
  // the TMS login page itself (same host) is allowed without being listed
  assert.equal((await call(loginHandler, { token: 'tok-dir', origin: 'https://tasks.example.test' })).status, 200)
})

// ----- pms-login -----
test('login: bad token 401, switched off / no role 403', async () => {
  assert.equal((await call(loginHandler, { token: 'nope' })).status, 401)
  assert.equal((await call(loginHandler, {})).status, 401)
  assert.equal((await call(loginHandler, { token: 'tok-off' })).status, 403)
  assert.equal((await call(loginHandler, { token: 'tok-norole' })).status, 403)
})

test('login: creates the profile once, never overwrites role, department follows the PMS role', async () => {
  const r = await call(loginHandler, { token: 'tok-ops' })
  assert.equal(r.status, 200)
  assert.equal(r.body.token, 'custom:opsUid:operations')
  const p = db.store['users/opsUid']
  assert.equal(p.role, 'employee'); assert.equal(p.departmentId, 'operation'); assert.equal(p.pmsRole, 'operations'); assert.equal(p.name, 'Omar Ops')
  db.store['users/opsUid'] = { ...p, role: 'dept_manager', departmentId: 'sales' }
  await call(loginHandler, { token: 'tok-ops' })
  assert.equal(db.store['users/opsUid'].role, 'dept_manager')
  assert.equal(db.store['users/opsUid'].departmentId, 'operation')
})

// ----- pms-task create -----
test('create: Directors only, needs a title', async () => {
  assert.equal((await call(taskHandler, { token: 'tok-ops', body: { action: 'create', data: { title: 'x' } } })).status, 403)
  assert.equal((await task({ action: 'create', data: { title: '  ' } })).status, 400)
  assert.equal((await task({ action: 'nope' })).status, 400)
})

test('create: first column, end position, subtask shape, activity, placeholder assignee profile', async () => {
  db.store['tasks/old'] = { columnId: 'col0', position: 3000 }
  const r = await task({ action: 'create', data: {
    title: 'Inspect unit', details: 'Placeholder details', assigneeUids: ['opsUid'], dueDate: '2026-11-01',
    subtasks: ['Photos', '', 'Keys'], pmsLink: { type: 'newOwnerListing', id: 'NL-0001' },
  } })
  assert.equal(r.status, 200)
  const t = db.store[`tasks/${r.body.taskId}`]
  assert.equal(t.columnId, 'col0'); assert.equal(t.status, 'NEW PROJECT'); assert.equal(t.position, 4000)
  assert.deepEqual(t.assignedTo, ['opsUid']); assert.equal(t.createdBy, 'dirUid'); assert.equal(t.description, 'Placeholder details')
  assert.equal(t.subtasks.length, 2)
  assert.deepEqual(Object.keys(t.subtasks[0]).sort(), ['done', 'id', 'title']); assert.equal(t.subtasks[0].done, false)
  assert.equal(t.dueDate.toDate().toISOString(), '2026-10-31T16:00:00.000Z') // midnight in Malaysia
  assert.equal(t.departmentId, 'operation') // guessed from the assignee's PMS role
  assert.equal(t.pmsKey, 'newOwnerListing:NL-0001')
  const acts = Object.entries(db.store).filter(([k]) => k.startsWith('task_activities/')).map(([, v]) => v)
  assert.equal(acts.length, 1); assert.equal(acts[0].taskId, r.body.taskId); assert.equal(acts[0].action, 'created')
  assert.equal(db.store['users/opsUid'].stub, true) // never signed in yet
})

test('create: refuses switched-off or unknown assignees and bad pmsLink', async () => {
  assert.equal((await task({ action: 'create', data: { title: 'x', assigneeUids: ['offUid'] } })).status, 400)
  assert.equal((await task({ action: 'create', data: { title: 'x', assigneeUids: ['ghost'] } })).status, 400)
  assert.equal((await task({ action: 'create', data: { title: 'x', pmsLink: { type: 'a/b', id: '1' } } })).status, 400)
})

// ----- update and list -----
async function seeded() {
  const r = await task({ action: 'create', data: { title: 'T', assigneeUids: ['opsUid'], subtasks: ['A', 'B'], pmsLink: { type: 'nol', id: '7' }, departmentId: 'finance' } })
  return r.body.taskId
}

test('update: assignee may note and complete, others may not; completed moves to DONE', async () => {
  const id = await seeded()
  assert.equal(db.store[`tasks/${id}`].departmentId, 'finance')
  await call(loginHandler, { token: 'tok-ops' }) // stub becomes a real profile
  assert.equal(db.store['users/opsUid'].stub, undefined)
  db.store['users/hrUid'] = { role: 'employee' }
  PMS_USERS.hrUid = { role: 'hr', active: true, displayName: 'H' }; TOKENS['tok-hr'] = 'hrUid'
  assert.equal((await call(taskHandler, { token: 'tok-hr', body: { action: 'update', taskId: id, data: { text: 'hi' } } })).status, 403)
  assert.equal((await call(taskHandler, { token: 'tok-ops', body: { action: 'update', taskId: 'missing', data: { text: 'hi' } } })).status, 404)
  assert.equal((await call(taskHandler, { token: 'tok-ops', body: { action: 'update', taskId: id, data: {} } })).status, 400)

  const subId = db.store[`tasks/${id}`].subtasks[0].id
  const r = await call(taskHandler, { token: 'tok-ops', body: { action: 'update', taskId: id, data: { text: 'Done it', completed: true, subtasks: [{ id: subId, done: true }] } } })
  assert.equal(r.status, 200); assert.equal(r.body.completed, true); assert.equal(r.body.status, 'DONE')
  const t = db.store[`tasks/${id}`]
  assert.equal(t.columnId, 'col4'); assert.ok(t.completedAt); assert.equal(t.subtasks[0].done, true)
  const acts = Object.values(db.store).filter((v) => v.taskId === id).map((a) => a.action)
  assert.deepEqual(acts.sort(), ['commented', 'created', 'moved', 'updated'])

  const l = await call(taskHandler, { token: 'tok-ops', body: { action: 'list', data: { type: 'nol', id: '7' } } })
  assert.equal(l.status, 200); assert.equal(l.body.tasks.length, 1)
  assert.deepEqual([l.body.tasks[0].subtasksDone, l.body.tasks[0].subtasksTotal, l.body.tasks[0].completed], [1, 2, true])

  // reopening (Director) moves it back to the first open column
  const re = await task({ action: 'update', taskId: id, data: { completed: false } })
  assert.equal(re.body.status, 'NEW PROJECT'); assert.equal(db.store[`tasks/${id}`].completedAt, null)
})

test('update: no done column -> completedAt only', async () => {
  const id = await seeded()
  db.store['columns/col4'].isDone = false
  const r = await task({ action: 'update', taskId: id, data: { completed: true } })
  assert.equal(r.status, 200); assert.equal(db.store[`tasks/${id}`].columnId, 'col0'); assert.ok(db.store[`tasks/${id}`].completedAt)
})

test('link moves NEW PROJECT to TODO; started then moves it to DOING', async () => {
  const id = await seeded()
  delete db.store[`tasks/${id}`].pmsLink; delete db.store[`tasks/${id}`].pmsKey // a task made in the TMS, not linked yet
  const l = await task({ action: 'link', taskId: id, data: { pmsLink: { type: 'newOwnerListing', id: 'NL-0009' } } })
  assert.equal(l.status, 200); assert.equal(db.store[`tasks/${id}`].columnId, 'col1'); assert.equal(db.store[`tasks/${id}`].status, 'TODO')
  const u = await task({ action: 'update', taskId: id, data: { text: 'Agreement skipped', started: true } })
  assert.equal(u.body.status, 'DOING')
})

test('update: departmentId hands the task over; Procurement still syncs a listing task after', async () => {
  const id = await seeded()
  db.store[`tasks/${id}`].pmsLink = { type: 'newOwnerListing', id: 'NL-0001' }
  db.store[`tasks/${id}`].departmentId = 'procurement'
  assert.equal((await task({ action: 'update', taskId: id, data: { text: 'x', departmentId: 'nope' } })).status, 400)
  const r = await task({ action: 'update', taskId: id, data: { text: 'Paid', departmentId: 'marketing' } })
  assert.equal(r.status, 200); assert.equal(db.store[`tasks/${id}`].departmentId, 'marketing')
  const p = await call(taskHandler, { token: 'tok-proc', body: { action: 'update', taskId: id, data: { text: 'Live', departmentId: 'operation' } } })
  assert.equal(p.status, 200); assert.equal(db.store[`tasks/${id}`].departmentId, 'operation')
})

test('update: started moves a waiting task to DOING, never backwards', async () => {
  const id = await seeded()
  const r = await task({ action: 'update', taskId: id, data: { text: 'Agreement signed', started: true } })
  assert.equal(r.status, 200); assert.equal(r.body.status, 'DOING'); assert.equal(db.store[`tasks/${id}`].columnId, 'col2')
  db.store[`tasks/${id}`].columnId = 'col3'; db.store[`tasks/${id}`].status = 'REVIEW'
  const again = await task({ action: 'update', taskId: id, data: { text: 'More', started: true } })
  assert.equal(again.body.status, 'REVIEW'); assert.equal(db.store[`tasks/${id}`].columnId, 'col3')
})

test('list: needs type and id', async () => {
  assert.equal((await task({ action: 'list', data: {} })).status, 400)
  assert.deepEqual((await task({ action: 'list', data: { type: 'nol', id: 'none' } })).body.tasks, [])
})

// ----- inbox, link and the Procurement sync -----
const proc = (body) => call(taskHandler, { token: 'tok-proc', body })
function boardTask(id, extra = {}) {
  db.store[`tasks/${id}`] = { title: `Task ${id}`, description: 'Placeholder brief', departmentId: 'procurement', columnId: 'col1', status: 'TODO',
    assignedTo: [], subtasks: [], completedAt: null, createdAt: ts(new Date(`2026-10-0${extra.day || 1}T00:00:00Z`)), dueDate: ts(new Date('2026-11-05T16:00:00Z')), ...extra }
}

test('inbox: Procurement sees open, unlinked tasks of its own department; Directors pick a department', async () => {
  boardTask('p1', { day: 2 }); boardTask('p2', { day: 1 })
  boardTask('p3', { pmsKey: 'newOwnerListing:NL-0009', pmsLink: { type: 'newOwnerListing', id: 'NL-0009' } })
  boardTask('p4', { completedAt: ts() })
  boardTask('m1', { departmentId: 'marketing' })
  const r = await proc({ action: 'inbox' })
  assert.equal(r.status, 200); assert.equal(r.body.departmentId, 'procurement')
  assert.deepEqual(r.body.tasks.map((t) => t.id), ['p2', 'p1']) // oldest first, linked and completed left out
  assert.equal(r.body.tasks[0].description, 'Placeholder brief'); assert.equal(r.body.tasks[0].dueDate, '2026-11-05T16:00:00.000Z')
  assert.deepEqual((await task({ action: 'inbox' })).body.tasks.map((t) => t.id), ['p2', 'p1']) // Director: procurement by default
  assert.deepEqual((await task({ action: 'inbox', data: { departmentId: 'marketing' } })).body.tasks.map((t) => t.id), ['m1'])
  // a Procurement user cannot look at another department
  assert.equal((await proc({ action: 'inbox', data: { departmentId: 'marketing' } })).body.departmentId, 'procurement')
  assert.equal((await call(taskHandler, { token: 'tok-ops', body: { action: 'inbox' } })).status, 403)
  for (let i = 0; i < 60; i++) boardTask(`x${i}`)
  assert.equal((await proc({ action: 'inbox' })).body.tasks.length, 50)
})

test('link: same department or Director; refuses a task linked elsewhere; same link again is fine', async () => {
  boardTask('p1'); boardTask('m1', { departmentId: 'marketing' })
  const link = { type: 'newOwnerListing', id: 'NL-0001' }
  assert.equal((await proc({ action: 'link', taskId: 'm1', data: { pmsLink: link } })).status, 403)
  assert.equal((await proc({ action: 'link', taskId: 'nope', data: { pmsLink: link } })).status, 404)
  assert.equal((await proc({ action: 'link', taskId: 'p1', data: {} })).status, 400)
  const r = await proc({ action: 'link', taskId: 'p1', data: { pmsLink: link } })
  assert.equal(r.status, 200); assert.equal(r.body.pmsKey, 'newOwnerListing:NL-0001')
  assert.deepEqual(db.store['tasks/p1'].pmsLink, link); assert.ok(db.store['tasks/p1'].labels.includes('PMS'))
  assert.equal((await proc({ action: 'link', taskId: 'p1', data: { pmsLink: link } })).status, 200)
  assert.equal((await proc({ action: 'link', taskId: 'p1', data: { pmsLink: { type: 'newOwnerListing', id: 'NL-0002' } } })).status, 409)
  assert.equal((await task({ action: 'link', taskId: 'm1', data: { pmsLink: { type: 'newOwnerListing', id: 'NL-0003' } } })).status, 200)
  assert.equal((await proc({ action: 'inbox' })).body.tasks.length, 0)
  const acts = Object.values(db.store).filter((v) => v.taskId === 'p1').map((a) => a.detail)
  assert.deepEqual(acts, ['linked to NL-0001 in the PMS'])
  // list tells the departments apart
  const l = await proc({ action: 'list', data: link })
  assert.equal(l.body.tasks[0].departmentId, 'procurement')
})

test('update: Procurement syncs the whole checklist of a same-department task, keeping ids; adds a note; completes', async () => {
  boardTask('p1', { subtasks: [{ id: 's-a', title: 'Painting', done: false }, { id: 's-b', title: 'Old line', done: false }] })
  boardTask('m1', { departmentId: 'marketing' })
  assert.equal((await proc({ action: 'update', taskId: 'm1', data: { text: 'x' } })).status, 403)
  const r = await proc({ action: 'update', taskId: 'p1', data: { text: 'Renovation: Painting Done', subtasks: [
    { title: 'Service agreement', done: true }, { title: 'Painting', done: true }, { title: '  ', done: true }] } })
  assert.equal(r.status, 200); assert.equal(r.body.completed, false)
  const subs = db.store['tasks/p1'].subtasks
  assert.deepEqual(subs.map((s) => [s.title, s.done]), [['Service agreement', true], ['Painting', true]])
  assert.equal(subs[1].id, 's-a'); assert.ok(subs[0].id && subs[0].id !== 's-b')
  const acts = Object.values(db.store).filter((v) => v.taskId === 'p1').map((a) => a.action)
  assert.deepEqual(acts.sort(), ['commented', 'updated'])
  // the same checklist again is not an error, and adds nothing
  const again = await proc({ action: 'update', taskId: 'p1', data: { subtasks: subs.map((s) => ({ title: s.title, done: s.done })) } })
  assert.equal(again.status, 200)
  assert.equal(Object.values(db.store).filter((v) => v.taskId === 'p1').length, 2)
  // complete when the listing goes live, then reopen
  const done = await proc({ action: 'update', taskId: 'p1', data: { text: 'Live', completed: true } })
  assert.equal(done.body.completed, true); assert.equal(db.store['tasks/p1'].columnId, 'col4')
  assert.equal((await proc({ action: 'update', taskId: 'p1', data: { completed: false } })).body.status, 'NEW PROJECT')
  // the old tick-by-id form still works
  const sid = db.store['tasks/p1'].subtasks[0].id
  await proc({ action: 'update', taskId: 'p1', data: { subtasks: [{ id: sid, done: false }] } })
  assert.equal(db.store['tasks/p1'].subtasks[0].done, false)
})
// ----- workspace backfill (old workspaces get superPrivate: false so every Director can list them) -----
test('backfill: Directors only; fills only a missing superPrivate, never changes true or false', async () => {
  db.store['users/dirUid'] = { role: 'super_admin' }; db.store['users/opsUid'] = { role: 'employee' }
  db.store['workspaces/old1'] = { name: 'Old' }
  db.store['workspaces/old2'] = { name: 'Old 2' }
  db.store['workspaces/open'] = { name: 'Open', superPrivate: false }
  db.store['workspaces/priv'] = { name: 'Private', superPrivate: true }
  assert.equal((await call(backfillHandler, {})).status, 401)
  assert.equal((await call(backfillHandler, { token: 'bad' })).status, 401)
  assert.equal((await call(backfillHandler, { token: 'tms-opsUid' })).status, 403)
  const r = await call(backfillHandler, { token: 'tms-dirUid' })
  assert.equal(r.status, 200); assert.equal(r.body.fixed, 2)
  assert.equal(db.store['workspaces/old1'].superPrivate, false); assert.equal(db.store['workspaces/old2'].superPrivate, false)
  assert.equal(db.store['workspaces/priv'].superPrivate, true)
  assert.equal((await call(backfillHandler, { token: 'tms-dirUid' })).body.fixed, 0) // safe to repeat
})
