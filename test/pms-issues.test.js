// action 'issue' of /api/pms-task (PMS Issues <-> Maintenance workspace), against an in-memory Firestore and a fake PMS.
// npm test   (no Firebase project or network needed; placeholder data only)
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { setServicesForTest } from '../api/_lib/pms.js'
import taskHandler from '../api/pms-task.js'
import { pmsStatusOfColumn, columnForPmsStatus, issueDepartment, sameBoardName } from '../api/_lib/issueStatus.js'

process.env.ALLOWED_ORIGINS = 'https://pms.example.test'

const TS = { __ts: true }
const ts = (d = new Date()) => ({ toDate: () => d })
const apply = (base, data) => {
  const out = { ...base }
  for (const [k, v] of Object.entries(data)) out[k] = v === TS ? ts() : v
  return out
}
function fakeDb() {
  const store = {}
  let n = 0
  const docRef = (col, id = `auto${++n}`) => ({
    id, path: `${col}/${id}`,
    async get() { const d = store[`${col}/${id}`]; return { exists: !!d, id, data: () => d } },
    async set(data) { store[`${col}/${id}`] = apply({}, data) },
    async create(data) { if (store[`${col}/${id}`]) throw Object.assign(new Error('ALREADY_EXISTS'), { code: 6 }); store[`${col}/${id}`] = apply({}, data) },
    async update(data) { if (!store[`${col}/${id}`]) throw new Error('NOT_FOUND'); store[`${col}/${id}`] = apply(store[`${col}/${id}`], data) },
    async delete() { delete store[`${col}/${id}`] },
  })
  const q = (col, filters = [], lim = Infinity) => ({
    where: (f, op, v) => q(col, [...filters, [f, op, v]], lim),
    limit: (l) => q(col, filters, l),
    async get() {
      const docs = Object.entries(store).filter(([k]) => k.split('/')[0] === col)
        .map(([k, d]) => ({ id: k.split('/')[1], data: () => d, ref: docRef(col, k.split('/')[1]) }))
        .filter((d) => filters.every(([f, , v]) => d.data()[f] === v)).slice(0, lim)
      return { docs }
    },
  })
  return {
    store,
    collection: (col) => ({ doc: (id) => docRef(col, id), ...q(col) }),
    batch() {
      const ops = []
      return {
        set: (r, d) => ops.push(() => r.set(d)), delete: (r) => ops.push(() => r.delete()), create: (r, d) => ops.push(() => r.create(d)), update: (r, d) => ops.push(() => r.update(d)),
        commit: async () => { for (const o of ops) await o() },
      }
    },
  }
}

// ----- the fake PMS: staff, and tickets readable as the PMS rules allow (Director, a tagged role, or the raiser) -----
const STAFF = {
  dirUid: { role: 'director', displayName: 'Dina Director' },
  opsUid: { role: 'operations', displayName: 'Omar Ops' },
  mktUid: { role: 'marketing', displayName: 'Mia Marketing' },
}
const TOKENS = { 'tok-dir': 'dirUid', 'tok-ops': 'opsUid', 'tok-mkt': 'mktUid' }
const TAG = { director: 'Director', operations: 'Operations', marketing: 'Marketing' }
let ISSUES
const val = (v) => (Array.isArray(v) ? { arrayValue: { values: v.map(val) } } : typeof v === 'boolean' ? { booleanValue: v } : v == null ? { nullValue: null } : { stringValue: String(v) })
const fieldsOf = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)]))
async function fakeFetch(url, { headers }) {
  const caller = TOKENS[headers.Authorization.replace('Bearer ', '')]
  const no = { ok: false, json: async () => ({}) }
  if (url.includes('/users/')) {
    const uid = url.split('/users/')[1]
    return caller === uid && STAFF[uid] ? { ok: true, json: async () => ({ fields: fieldsOf({ ...STAFF[uid], active: true }) }) } : no
  }
  const id = url.split('/issues/')[1]
  const t = ISSUES[id]
  const role = STAFF[caller]?.role
  if (!t || !(role === 'director' || t.tags.includes(TAG[role]) || t.raisedByUid === caller)) return no
  return { ok: true, json: async () => ({ fields: fieldsOf(t) }) }
}

let db
beforeEach(() => {
  db = fakeDb()
  ISSUES = {
    'IS-0001': { title: 'Aircond leaking', body: 'Master bedroom', status: 'open', tags: ['Operations'], property: 'Vista Tower', propertyId: 'p1', unit: 'VT-12A', raisedByUid: 'mktUid' },
    'IS-0002': { title: 'Laptop broken', body: 'In the lobby', status: 'open', tags: ['Marketing'], property: 'vista tower', unit: '', raisedByUid: 'mktUid' },
    'IS-0003': { title: 'Door lock', body: '', status: 'open', tags: ['Procurement', 'Operations'], property: '', unit: '', raisedByUid: 'opsUid' },
  }
  db.store['workspaces/wsM'] = { name: 'Maintenance', archived: false, members: {}, memberIds: [] }
  db.store['boards/bVista'] = { workspaceId: 'wsM', name: 'Vista Tower', archived: false }
  ;['TODO', 'DOING', 'WAITING PARTS', 'DONE'].forEach((name, i) => {
    db.store[`columns/v${i}`] = { boardId: 'bVista', name, position: (i + 1) * 1000, isDone: name === 'DONE', archived: false }
  })
  setServicesForTest({
    db, fetch: fakeFetch,
    FieldValue: { serverTimestamp: () => TS },
    Timestamp: { fromDate: ts },
    pmsAuth: { verifyIdToken: async (t) => { if (!TOKENS[t]) throw new Error('bad'); return { uid: TOKENS[t] } } },
  })
})

async function call(token, body) {
  const res = { headers: {}, code: 0, body: null, setHeader(k, v) { this.headers[k] = v }, status(c) { this.code = c; return this }, json(b) { this.body = b; return this }, end() { return this } }
  await taskHandler({ method: 'POST', headers: { origin: 'https://pms.example.test', authorization: `Bearer ${token}` }, body }, res)
  return res
}
const sync = (token, id, extra = {}) => call(token, { action: 'issue', data: { id, ...extra } })
const task = (id) => db.store[`tasks/issue-${id}`]
const colName = (id) => db.store[`columns/${task(id).columnId}`].name

test('mapping: first open column is Open, other open columns In progress, a completed column Done', () => {
  const cols = ['TODO', 'DOING', 'WAITING PARTS', 'DONE'].map((name, i) => ({ id: `c${i}`, name, position: i, isDone: name === 'DONE' }))
  assert.deepEqual(cols.map((c) => pmsStatusOfColumn(c, cols)), ['open', 'progress', 'progress', 'done'])
  assert.equal(columnForPmsStatus('open', cols).name, 'TODO')
  assert.equal(columnForPmsStatus('progress', cols).name, 'DOING')
  assert.equal(columnForPmsStatus('done', cols).name, 'DONE')
  // renamed columns still work: position and "counts as completed" decide, not names
  const renamed = cols.map((c) => ({ ...c, name: { TODO: 'NEW', DOING: 'FIXING', 'WAITING PARTS': 'PARTS', DONE: 'FINISHED' }[c.name] }))
  assert.equal(columnForPmsStatus('progress', renamed).name, 'FIXING') // the 2nd open column when none is called DOING
  assert.equal(issueDepartment(['Marketing', 'Procurement', 'Operations']), 'procurement')
  assert.equal(issueDepartment(['Director']), 'operation')
})

test('board names match property names whatever the capitals, spaces or apostrophe', () => {
  assert.ok(sameBoardName("D'Majestic Place", 'd’majestic  place '))
  assert.ok(sameBoardName('Novo Ampang', 'NOVO AMPANG'))
  assert.ok(!sameBoardName('Novo Ampang', 'Novo'))
})

test('a new Operations ticket becomes a task on its property board, in TODO', async () => {
  const r = await sync('tok-mkt', 'IS-0001') // the person who raised it (Marketing) can sync it
  assert.equal(r.code, 200, JSON.stringify(r.body))
  assert.equal(r.body.created, true)
  const t = task('IS-0001')
  assert.equal(t.boardId, 'bVista')
  assert.equal(t.workspaceId, 'wsM')
  assert.equal(colName('IS-0001'), 'TODO')
  assert.equal(t.title, 'Aircond leaking')
  assert.equal(t.description, 'Master bedroom')
  assert.equal(t.departmentId, 'operation')
  assert.deepEqual(t.pmsLink, { type: 'issue', id: 'IS-0001' })
  assert.deepEqual(t.labels, ['PMS', 'IS-0001', 'VT-12A'])
  assert.equal(db.store['boards/bVista'].pmsPropertyId, 'p1') // remembered for next time
})

test('every ticket gets a task, whatever is tagged (an In-house one too), on its property board', async () => {
  const r = await sync('tok-mkt', 'IS-0002') // tagged Marketing only, property name in other capitals
  assert.equal(r.code, 200, JSON.stringify(r.body))
  assert.equal(r.body.created, true)
  assert.equal(task('IS-0002').boardId, 'bVista')
  assert.equal(task('IS-0002').departmentId, 'operation')
})

test('no property, or a property with no board: refused with the reason, and no board is made', async () => {
  const boards = () => Object.keys(db.store).filter((k) => k.startsWith('boards/')).length
  const before = boards()
  let r = await sync('tok-ops', 'IS-0003') // no property
  assert.equal(r.code, 409)
  assert.match(r.body.error, /no property/)
  ISSUES['IS-0003'].property = 'Novo Ampang'
  r = await sync('tok-ops', 'IS-0003')
  assert.equal(r.code, 409)
  assert.match(r.body.error, /no board called "Novo Ampang"/)
  assert.equal(boards(), before)
  assert.equal(task('IS-0003'), undefined)
  // once the board exists, the next change puts it in
  db.store['boards/bNovo'] = { workspaceId: 'wsM', name: 'Novo Ampang', archived: false }
  ;['TODO', 'DOING', 'DONE'].forEach((name, i) => { db.store[`columns/n${i}`] = { boardId: 'bNovo', name, position: i, isDone: name === 'DONE', archived: false } })
  r = await sync('tok-ops', 'IS-0003')
  assert.equal(r.code, 200, JSON.stringify(r.body))
  assert.equal(task('IS-0003').boardId, 'bNovo')
  assert.equal(task('IS-0003').departmentId, 'procurement')
})

test('the ticket property changes in the PMS: its task moves to that board, same status', async () => {
  ISSUES['IS-0001'].status = 'progress'
  await sync('tok-ops', 'IS-0001')
  db.store['boards/bNovo'] = { workspaceId: 'wsM', name: 'Novo Ampang', archived: false }
  ;['TODO', 'DOING', 'DONE'].forEach((name, i) => { db.store[`columns/n${i}`] = { boardId: 'bNovo', name, position: i, isDone: name === 'DONE', archived: false } })
  Object.assign(ISSUES['IS-0001'], { property: 'Novo Ampang', propertyId: 'p2' })
  const r = await sync('tok-ops', 'IS-0001')
  assert.equal(r.code, 200, JSON.stringify(r.body))
  assert.equal(task('IS-0001').boardId, 'bNovo')
  assert.equal(colName('IS-0001'), 'DOING')
  assert.equal(r.body.boardId, 'bNovo')
})

test('maintenanceBoards lists the property boards of the Maintenance workspace', async () => {
  db.store['boards/bOld'] = { workspaceId: 'wsM', name: 'Closed', archived: true }
  db.store['boards/bX'] = { workspaceId: 'wsX', name: 'Elsewhere', archived: false }
  const r = await call('tok-mkt', { action: 'maintenanceBoards' })
  assert.equal(r.code, 200, JSON.stringify(r.body))
  assert.deepEqual(r.body.boards.map((b) => b.name), ['Vista Tower'])
})

test('status, title and description follow the ticket; a custom column is kept while In progress', async () => {
  await sync('tok-ops', 'IS-0001')
  ISSUES['IS-0001'].status = 'progress'
  ISSUES['IS-0001'].title = 'Aircond leaking badly'
  let r = await sync('tok-ops', 'IS-0001')
  assert.equal(colName('IS-0001'), 'DOING')
  assert.equal(r.body.column, 'DOING')
  assert.equal(task('IS-0001').title, 'Aircond leaking badly')

  // someone moved the card to WAITING PARTS in the TMS: still "In progress", so a PMS sync leaves it there
  db.store['tasks/issue-IS-0001'].columnId = 'v2'
  r = await sync('tok-ops', 'IS-0001')
  assert.equal(colName('IS-0001'), 'WAITING PARTS')
  assert.equal(r.body.unchanged, true)

  ISSUES['IS-0001'].status = 'done'
  await sync('tok-ops', 'IS-0001')
  assert.equal(colName('IS-0001'), 'DONE')
  assert.ok(task('IS-0001').completedAt)
})

test('deleted in the PMS: the task and its activity records are deleted, and not made again', async () => {
  await sync('tok-ops', 'IS-0001')
  ISSUES['IS-0001'].status = 'progress'
  await sync('tok-ops', 'IS-0001') // a second activity record
  assert.equal(Object.values(db.store).filter((d) => d.taskId === 'issue-IS-0001').length, 2)
  Object.assign(ISSUES['IS-0001'], { status: 'deleted', deleteReason: 'Raised twice' })
  const r = await sync('tok-dir', 'IS-0001')
  assert.equal(r.code, 200, JSON.stringify(r.body))
  assert.equal(r.body.deleted, true)
  assert.equal(task('IS-0001'), undefined)
  assert.equal(Object.values(db.store).filter((d) => d.taskId === 'issue-IS-0001').length, 0)
  const again = await sync('tok-dir', 'IS-0001') // a later sync of a deleted ticket makes nothing
  assert.equal(again.body.taskId, null)
  assert.equal(task('IS-0001'), undefined)
})

test('someone who cannot see the ticket in the PMS gets 404, and bad numbers 400', async () => {
  assert.equal((await sync('tok-mkt', 'IS-0003')).code, 404) // Marketing is not tagged and did not raise it
  assert.equal((await sync('tok-ops', '../users/dirUid')).code, 400)
})

test('a ticket raised from a TMS board is put on that board; a board outside Maintenance is refused', async () => {
  db.store['boards/bOther'] = { workspaceId: 'wsX', name: 'Elsewhere', archived: false }
  assert.equal((await sync('tok-ops', 'IS-0003', { boardId: 'bOther' })).code, 400)
  const r = await sync('tok-ops', 'IS-0003', { boardId: 'bVista' })
  assert.equal(r.code, 200, JSON.stringify(r.body))
  assert.equal(task('IS-0003').boardId, 'bVista')
})

test('the Owner Leads fix: a linked task of a workspace board moves within ITS board', async () => {
  db.store['boards/bLeads'] = { workspaceId: 'wsP', name: 'Owner Leads', archived: false }
  ;['NEW PROJECT', 'TODO', 'DOING', 'DONE'].forEach((name, i) => {
    db.store[`columns/L${i}`] = { boardId: 'bLeads', name, position: (i + 1) * 1000, isDone: name === 'DONE', archived: false }
  })
  db.store['tasks/lead1'] = { boardId: 'bLeads', columnId: 'L0', status: 'NEW PROJECT', title: 'New owner', departmentId: 'procurement', assignedTo: [], subtasks: [], activitySeq: 1 }
  const r = await call('tok-dir', { action: 'update', taskId: 'lead1', data: { completed: true } })
  assert.equal(r.code, 200, JSON.stringify(r.body))
  assert.equal(db.store['tasks/lead1'].columnId, 'L3') // the DONE column of Owner Leads, not of the Main board
})
