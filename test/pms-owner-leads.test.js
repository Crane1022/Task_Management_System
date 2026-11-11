// actions ownerLeads, moveOwnerLead and link of /api/pms-task (PMS Owner Leads <-> the Owner Leads board), in-memory Firestore and fake PMS.
// npm test   (no Firebase project or network needed; placeholder data only)
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { setServicesForTest } from '../api/_lib/pms.js'
import taskHandler from '../api/pms-task.js'

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

// ----- the fake PMS: staff records only -----
const STAFF = {
  dirUid: { role: 'director', displayName: 'Dina Director' },
  proUid: { role: 'procurement', displayName: 'Pat Procurement' },
  mktUid: { role: 'marketing', displayName: 'Mia Marketing' },
  finUid: { role: 'finance', displayName: 'Fay Finance' },
}
const TOKENS = { 'tok-dir': 'dirUid', 'tok-pro': 'proUid', 'tok-mkt': 'mktUid', 'tok-fin': 'finUid' }
const val = (v) => (typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) })
const fieldsOf = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)]))
async function fakeFetch(url, { headers }) {
  const caller = TOKENS[headers.Authorization.replace('Bearer ', '')]
  const uid = url.split('/users/')[1]
  if (caller === uid && STAFF[uid]) return { ok: true, json: async () => ({ fields: fieldsOf({ ...STAFF[uid], active: true }) }) }
  return { ok: false, json: async () => ({}) }
}

let db
beforeEach(() => {
  db = fakeDb()
  db.store['workspaces/wsSecret'] = { name: 'Business Development & Procurement', superPrivate: true }
  db.store['workspaces/wsBD'] = { name: 'Business Development & Procurement', superPrivate: false }
  db.store['boards/bSecret'] = { workspaceId: 'wsSecret', name: 'Owner Leads' }
  db.store['boards/bOL'] = { workspaceId: 'wsBD', name: 'Owner Leads' }
  ;['NEW', 'IN PROGRESS', 'SIGNED', 'LIVE', 'CANCELLED'].forEach((name, i) => {
    db.store[`columns/c${i}`] = { boardId: 'bOL', name, position: (i + 1) * 1000, isDone: name === 'LIVE', archived: false }
  })
  db.store['tasks/t1'] = { boardId: 'bOL', columnId: 'c0', position: 1000, title: 'Owner at Vista 12A', departmentId: 'sales', assignedTo: ['proUid'], createdByName: 'Ben', createdAt: ts(new Date('2026-11-01T02:00:00Z')), activitySeq: 2 }
  db.store['tasks/t2'] = { boardId: 'bOL', columnId: 'c1', position: 1000, title: 'Linked lead', departmentId: 'procurement', pmsLink: { type: 'newOwnerListing', id: 'NL-0003' }, pmsKey: 'newOwnerListing:NL-0003', createdAt: ts(new Date('2026-10-01T02:00:00Z')) }
  db.store['tasks/t3'] = { boardId: 'bSecret', columnId: 'x', title: 'Secret', createdAt: ts() }
  db.store['tasks/t4'] = { boardId: 'bOL', columnId: 'c0', title: 'Archived', archived: true, createdAt: ts() }
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

test('ownerLeads: cards of the Owner Leads board only (not Super Private, not archived), oldest first, status from column', async () => {
  const r = await call('tok-mkt', { action: 'ownerLeads' })
  assert.equal(r.code, 200, JSON.stringify(r.body))
  assert.deepEqual(r.body.leads.map((l) => l.taskId), ['t2', 't1'])
  const t1 = r.body.leads.find((l) => l.taskId === 't1')
  assert.equal(t1.status, 'new'); assert.equal(t1.column, 'NEW'); assert.equal(t1.pmsLink, null)
  assert.deepEqual(t1.assigneeUids, ['proUid']); assert.equal(t1.createdAt, '2026-11-01T02:00:00.000Z')
  assert.equal(r.body.leads[0].status, 'progress')
  assert.equal((await call('tok-fin', { action: 'ownerLeads' })).code, 403)
})

test('moveOwnerLead: any direction, end of column, activity line; only Director or Procurement', async () => {
  assert.equal((await call('tok-mkt', { action: 'moveOwnerLead', taskId: 't1', data: { status: 'signed' } })).code, 403)
  let r = await call('tok-pro', { action: 'moveOwnerLead', taskId: 't1', data: { status: 'live' } })
  assert.equal(r.code, 200, JSON.stringify(r.body))
  assert.equal(db.store['tasks/t1'].columnId, 'c3')
  assert.ok(db.store['tasks/t1'].completedAt) // LIVE counts as completed on this fake board
  assert.match(db.store['task_activities/t1_2'].detail, /from NEW to LIVE\. Moved from the PMS by Pat Procurement/)
  r = await call('tok-dir', { action: 'moveOwnerLead', taskId: 't1', data: { status: 'progress' } })
  assert.equal(db.store['tasks/t1'].columnId, 'c1')
  assert.equal(db.store['tasks/t1'].completedAt, null)
  assert.equal(db.store['tasks/t1'].position, 2000) // after t2
  r = await call('tok-dir', { action: 'moveOwnerLead', taskId: 't1', data: { status: 'progress' } })
  assert.equal(r.body.moved, false)
  assert.equal((await call('tok-dir', { action: 'moveOwnerLead', taskId: 't3', data: { status: 'new' } })).code, 400)
  assert.equal((await call('tok-dir', { action: 'moveOwnerLead', taskId: 't1', data: { status: 'done' } })).code, 400)
})

test('link: Procurement links an Owner Leads card of another department to NL-000n', async () => {
  const r = await call('tok-pro', { action: 'link', taskId: 't1', data: { pmsLink: { type: 'newOwnerListing', id: 'NL-0009' } } })
  assert.equal(r.code, 200, JSON.stringify(r.body))
  assert.equal(db.store['tasks/t1'].pmsKey, 'newOwnerListing:NL-0009')
  // another type on that card, from Procurement: still refused (department rule)
  db.store['tasks/t5'] = { boardId: 'bOL', columnId: 'c0', departmentId: 'sales', createdAt: ts() }
  assert.equal((await call('tok-pro', { action: 'link', taskId: 't5', data: { pmsLink: { type: 'other', id: 'X' } } })).code, 403)
})

// ----- TMS -> PMS: what moving a linked card changes on the PMS listing -----
import { leadChanges, leadStatusOfColumn } from '../api/_lib/ownerLeadStatus.js'
const ME = { by: 'Pat', uid: 'proUid', isDirector: false }
const DIR = { by: 'Dina', uid: 'dirUid', isDirector: true }
const col = (name) => ({ id: name, name })

test('leadChanges: statuses, aging stamps both ways, cancel and Director-only reopen', () => {
  assert.equal(leadStatusOfColumn(col('In Progress')), 'progress')
  assert.equal(leadStatusOfColumn(col('WAITING')), null)
  let r = leadChanges({ id: 'NL-0001', status: 'inProgress' }, col('SIGNED'), ME, 'NOW', 'DEL')
  assert.equal(r.changes.status, 'signed'); assert.equal(r.changes.signedAt, 'NOW'); assert.match(r.line, /listing is Signed/)
  r = leadChanges({ id: 'NL-0001', status: 'live', signedAt: 'x', liveAt: 'y' }, col('IN PROGRESS'), ME, 'NOW', 'DEL')
  assert.equal(r.changes.signedAt, 'DEL'); assert.equal(r.changes.liveAt, 'DEL')
  r = leadChanges({ id: 'NL-0001', status: 'signed', signedAt: 'x' }, col('LIVE'), ME, 'NOW', 'DEL')
  assert.equal(r.changes.liveAt, 'NOW'); assert.equal('signedAt' in r.changes, false)
  r = leadChanges({ id: 'NL-0001', status: 'signed' }, col('CANCELLED'), ME, 'NOW', 'DEL')
  assert.equal(r.changes.prevStatus, 'signed'); assert.equal(r.changes.cancelledBy, 'Pat'); assert.match(r.line, /Not proceeding/)
  assert.throws(() => leadChanges({ id: 'NL-0001', status: 'cancelled' }, col('SIGNED'), ME, 'NOW', 'DEL'), /Only a Director/)
  r = leadChanges({ id: 'NL-0001', status: 'cancelled', prevStatus: 'signed' }, col('SIGNED'), DIR, 'NOW', 'DEL')
  assert.equal(r.changes.cancelReason, 'DEL'); assert.match(r.line, /reopened/)
  assert.throws(() => leadChanges({ id: 'NL-0001', status: 'progress' }, col('NEW'), DIR, 'NOW', 'DEL'), /can't go back to New/)
  r = leadChanges({ id: 'NL-0001', status: 'progress', tmsColumn: 'IN PROGRESS' }, col('WAITING'), ME, 'NOW', 'DEL')
  assert.deepEqual(r, { changes: { tmsColumn: 'WAITING' }, line: null })
})
