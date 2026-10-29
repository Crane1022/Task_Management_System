import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import handler from '../api/send-push.js'
import { linkFor, pushToUser } from '../api/_lib/push.js'
import { setServicesForTest } from '../api/_lib/pms.js'

// ----- a small fake database: users/{uid}/notifications/{id} and users/{uid}/devices/{id} -----
function fakeDb() {
  const store = {}
  const snap = (path) => ({ exists: path in store, data: () => store[path], ref: refOf(path) })
  const refOf = (path) => ({
    get: async () => snap(path),
    update: async (c) => { store[path] = { ...store[path], ...c } },
    delete: async () => { delete store[path] },
  })
  const col = (path) => ({
    doc: (id) => ({ ...refOf(`${path}/${id}`), collection: (n) => col(`${path}/${id}/${n}`) }),
    get: async () => ({ docs: Object.keys(store).filter((k) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes('/')).map(snap) }),
  })
  return { store, collection: (n) => col(n) }
}
const now = () => ({ toMillis: () => Date.now() })
let db, sent
const TOKENS = { 'tms-ana': 'ana', 'tms-bob': 'bob' }
function setup(failCodes = {}) {
  db = fakeDb(); sent = []
  setServicesForTest({
    db, FieldValue: { serverTimestamp: () => 'TS' },
    tmsAuth: { verifyIdToken: async (t) => { if (!TOKENS[t]) throw new Error('bad'); return { uid: TOKENS[t] } } },
    messaging: { sendEachForTokens: async (m) => { sent.push(m); return { responses: m.tokens.map((t) => (failCodes[t] ? { success: false, error: { code: failCodes[t] } } : { success: true })) } } },
  })
}
function call(token, items) {
  return new Promise((resolve) => {
    const res = { code: 200, setHeader() {}, status(c) { this.code = c; return this }, json(b) { resolve({ status: this.code, body: b }) }, end() { resolve({ status: this.code }) } }
    handler({ method: 'POST', headers: { host: 'tasks.test', origin: 'https://tasks.test', ...(token && { authorization: `Bearer ${token}` }) }, body: { items } }, res)
  })
}
const note = (over = {}) => ({ type: 'assigned', title: 'Ana assigned you a task', body: 'Fix it', taskId: 't1', boardId: 'main', byId: 'ana', createdAt: now(), ...over })

test('linkFor sends each kind to the right page', () => {
  assert.equal(linkFor({ taskId: 't 1', boardId: 'b1' }), '/b/b1?task=t%201')
  assert.equal(linkFor({ taskId: 't1' }), '/b/main?task=t1')
  assert.equal(linkFor({ type: 'mention', workspaceId: 'w1' }), '/workspaces/w1/chat')
  assert.equal(linkFor({ type: 'workspace_added', workspaceId: 'w1' }), '/workspaces/w1')
  assert.equal(linkFor({ type: 'workspace_removed', workspaceId: 'w1' }), '/')
})

test('send-push: needs a signed-in caller', async () => {
  setup()
  assert.equal((await call(null, [])).status, 401)
  assert.equal((await call('bad-token', [])).status, 401)
})

test('send-push: sends once to every device of the receiver, as a data message', async () => {
  setup()
  db.store['users/bob/notifications/n1'] = note()
  db.store['users/bob/devices/d1'] = { token: 'tokA' }
  db.store['users/bob/devices/d2'] = { token: 'tokB' }
  const r = await call('tms-ana', [{ uid: 'bob', id: 'n1' }])
  assert.equal(r.status, 200); assert.equal(r.body.sent, 2)
  assert.deepEqual(sent[0].tokens.sort(), ['tokA', 'tokB'])
  assert.deepEqual(sent[0].data, { title: 'Ana assigned you a task', body: 'Fix it', url: '/b/main?task=t1', tag: 'task-t1' })
  assert.ok(db.store['users/bob/notifications/n1'].pushedAt, 'marked as pushed')
  assert.equal((await call('tms-ana', [{ uid: 'bob', id: 'n1' }])).body.sent, 0, 'a repeat call sends nothing')
  assert.equal(sent.length, 1)
})

test('send-push: refuses anything that is not the caller\'s own fresh notification for someone else', async () => {
  setup()
  db.store['users/bob/devices/d1'] = { token: 'tokA' }
  db.store['users/ana/devices/d1'] = { token: 'tokSelf' }
  db.store['users/bob/notifications/other'] = note({ byId: 'carl' }) // written by somebody else
  db.store['users/bob/notifications/old'] = note({ createdAt: { toMillis: () => Date.now() - 10 * 60 * 1000 } })
  db.store['users/ana/notifications/self'] = note()
  const items = [{ uid: 'bob', id: 'other' }, { uid: 'bob', id: 'old' }, { uid: 'ana', id: 'self' }, { uid: 'bob', id: 'missing' }, { uid: 'a/b', id: 'x' }, { uid: 5, id: 'x' }]
  const r = await call('tms-ana', items)
  assert.equal(r.body.sent, 0); assert.equal(sent.length, 0)
})

test('a device the browser has forgotten is removed; other devices still get it', async () => {
  setup({ tokA: 'messaging/registration-token-not-registered' })
  db.store['users/bob/devices/d1'] = { token: 'tokA' }
  db.store['users/bob/devices/d2'] = { token: 'tokB' }
  const n = await pushToUser({ db, messaging: { sendEachForTokens: async (m) => ({ responses: m.tokens.map((t) => (t === 'tokA' ? { success: false, error: { code: 'messaging/registration-token-not-registered' } } : { success: true })) }) } }, 'bob', note())
  assert.equal(n, 1)
  assert.equal('users/bob/devices/d1' in db.store, false); assert.equal('users/bob/devices/d2' in db.store, true)
})

test('nobody turned pop-ups on, or the sender breaks: it returns 0 and never throws', async () => {
  setup()
  assert.equal(await pushToUser({ db, messaging: {} }, 'bob', note()), 0)
  db.store['users/bob/devices/d1'] = { token: 'tokA' }
  assert.equal(await pushToUser({ db, messaging: { sendEachForTokens: async () => { throw new Error('down') } } }, 'bob', note()), 0)
})

// ----- the service worker (public/sw.js), run in a sandbox with a pretend browser -----
function sandbox({ visible = false } = {}) {
  const listeners = {}, shown = [], opened = [], log = { focused: 0, navigated: [] }
  const client = { url: 'https://tasks.test/board', visibilityState: visible ? 'visible' : 'hidden', focused: visible, focus: async () => { log.focused++ }, navigate: async (u) => { log.navigated.push(u) } }
  const self = {
    location: { origin: 'https://tasks.test' },
    addEventListener: (n, f) => { listeners[n] = f },
    skipWaiting() {}, clients: { claim() {}, matchAll: async () => (visible || log.hasWindow ? [client] : []), openWindow: async (u) => { opened.push(u) } },
    registration: { showNotification: async (t, o) => { shown.push([t, o]) } },
  }
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), { self, URL })
  const run = async (name, ev) => { let p; ev.waitUntil = (x) => { p = x }; listeners[name](ev); await p }
  return { run, shown, opened, log, client, self }
}
const pushEvent = (data) => ({ data: { json: () => ({ data }) } })

test('sw: shows a pop-up from the FCM data message', async () => {
  const s = sandbox()
  await s.run('push', pushEvent({ title: 'Ana assigned you a task', body: 'Fix it', url: '/b/main?task=t1', tag: 'task-t1' }))
  assert.equal(s.shown.length, 1)
  assert.equal(s.shown[0][0], 'Ana assigned you a task')
  assert.equal(s.shown[0][1].body, 'Fix it'); assert.equal(s.shown[0][1].tag, 'task-t1'); assert.equal(s.shown[0][1].data.url, '/b/main?task=t1')
})

test('sw: no pop-up on top of the app while it is open in front (the bell shows it)', async () => {
  const s = sandbox({ visible: true })
  await s.run('push', pushEvent({ title: 'x', body: 'y' }))
  assert.equal(s.shown.length, 0)
})

test('sw: an empty or broken push still shows a plain pop-up (browsers require one)', async () => {
  const s = sandbox()
  await s.run('push', { data: { json: () => { throw new Error('not json') } } })
  assert.equal(s.shown[0][0], 'Widebed Tasks')
})

test('sw: clicking opens the app on that page, and never a page on another site', async () => {
  const s = sandbox()
  await s.run('notificationclick', { notification: { close() {}, data: { url: '/b/main?task=t1' } } })
  assert.deepEqual(s.opened, ['https://tasks.test/b/main?task=t1'])
  const evil = sandbox()
  await evil.run('notificationclick', { notification: { close() {}, data: { url: 'https://evil.test/phish' } } })
  assert.deepEqual(evil.opened, [])
})

test('sw: clicking focuses the app if it is already open and goes to the page', async () => {
  const s = sandbox(); s.log.hasWindow = true
  await s.run('notificationclick', { notification: { close() {}, data: { url: '/workspaces/w1/chat' } } })
  assert.equal(s.log.focused, 1); assert.deepEqual(s.log.navigated, ['https://tasks.test/workspaces/w1/chat']); assert.deepEqual(s.opened, [])
})
