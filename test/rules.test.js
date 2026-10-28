// Firestore rules tests. They need the Firebase emulator, so they are skipped on a normal `npm test`.
// Run them with (needs Java):
//   npm i -D firebase @firebase/rules-unit-testing firebase-tools
//   npx firebase emulators:exec --only firestore "node --test test/rules.test.js"
import test from 'node:test'
import { readFileSync } from 'node:fs'

const hostPort = process.env.FIRESTORE_EMULATOR_HOST
const skip = !hostPort && 'needs the Firestore emulator (see the comment at the top of this file)'

test('firestore.rules', { skip }, async (t) => {
  const { initializeTestEnvironment, assertSucceeds, assertFails } = await import('@firebase/rules-unit-testing')
  const { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } = await import('firebase/firestore')
  const [host, port] = hostPort.split(':')
  const env = await initializeTestEnvironment({ projectId: 'demo-widebed', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) } })
  const as = (uid) => env.authenticatedContext(uid).firestore()
  const user = (role, departmentId) => ({ name: 'x', email: 'x@y.z', role, departmentId, createdAt: new Date() })

  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', 'director'), user('super_admin', 'management'))
    await setDoc(doc(db, 'users', 'manager'), user('dept_manager', 'it'))
    await setDoc(doc(db, 'users', 'it1'), user('employee', 'it'))
    await setDoc(doc(db, 'users', 'hr1'), user('employee', 'hr'))
    await setDoc(doc(db, 'users', 'wsadmin'), user('employee', 'it'))
    await setDoc(doc(db, 'users', 'wsmember'), user('employee', 'it'))
    await setDoc(doc(db, 'users', 'wsviewer'), user('employee', 'it'))
    await setDoc(doc(db, 'users', 'outsider'), user('employee', 'it'))
    // the original board "main": no board document, so the department rules apply
    await setDoc(doc(db, 'tasks', 'legacy1'), { boardId: 'main', columnId: 'c', title: 't', departmentId: 'it', assignedTo: [], createdBy: 'it1' })
    await setDoc(doc(db, 'columns', 'legacyCol'), { boardId: 'main', name: 'TODO', position: 1 })
    // a workspace board
    await setDoc(doc(db, 'workspaces', 'W1'), { name: 'Ops', createdBy: 'wsadmin', members: { wsadmin: 'admin', wsmember: 'member', wsviewer: 'viewer' }, memberIds: ['wsadmin', 'wsmember', 'wsviewer'] })
    await setDoc(doc(db, 'boards', 'B1'), { workspaceId: 'W1', name: 'Board', createdBy: 'wsadmin', members: {} })
    await setDoc(doc(db, 'tasks', 'ws1'), { boardId: 'B1', columnId: 'c1', title: 't', departmentId: 'hr', assignedTo: [], createdBy: 'wsadmin' })
    await setDoc(doc(db, 'columns', 'col1'), { boardId: 'B1', name: 'TODO', position: 1 })
  })

  await t.test('original board: same department reads, other department does not, assignee does', async () => {
    await assertSucceeds(getDoc(doc(as('it1'), 'tasks', 'legacy1')))
    await assertFails(getDoc(doc(as('hr1'), 'tasks', 'legacy1')))
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'tasks', 'legacy1'), { assignedTo: ['hr1'] }))
    await assertSucceeds(getDoc(doc(as('hr1'), 'tasks', 'legacy1')))
  })
  await t.test('original board: an assignee cannot change who created the task', async () => {
    await assertFails(updateDoc(doc(as('it1'), 'tasks', 'legacy1'), { createdBy: 'it1x' }))
    await assertSucceeds(updateDoc(doc(as('it1'), 'tasks', 'legacy1'), { title: 'renamed' }))
    // anyone with a profile may reorder the columns of the original board (position only), but not rename them
    await assertSucceeds(updateDoc(doc(as('hr1'), 'columns', 'legacyCol'), { position: 3000 }))
    await assertFails(updateDoc(doc(as('hr1'), 'columns', 'legacyCol'), { name: 'X' }))
    // every role that can see a card on the original board may drag it, but not edit it
    await assertSucceeds(updateDoc(doc(as('hr1'), 'tasks', 'legacy1'), { columnId: 'c2', status: 'DOING', position: 2000, completedAt: null, updatedAt: new Date() })) // hr1 is an assignee here
    await assertFails(updateDoc(doc(as('hr1'), 'tasks', 'legacy1'), { title: 'sneaky' }))
    await assertFails(updateDoc(doc(as('hr1'), 'tasks', 'legacy1'), { columnId: 'c3', departmentId: 'hr' }))
  })
  await t.test('users: only the allow-listed fields can be edited by the person', async () => {
    await assertSucceeds(updateDoc(doc(as('it1'), 'users', 'it1'), { displayName: 'Ana' }))
    await assertFails(updateDoc(doc(as('it1'), 'users', 'it1'), { role: 'super_admin' }))
    await assertFails(updateDoc(doc(as('it1'), 'users', 'it1'), { employeeId: 'E1' }))
    await assertFails(updateDoc(doc(as('it1'), 'users', 'it1'), { departmentId: 'finance' }))
    await assertSucceeds(updateDoc(doc(as('director'), 'users', 'it1'), { employeeId: 'E1', jobTitle: 'Tech' }))
    await assertFails(updateDoc(doc(as('director'), 'users', 'director'), { role: 'employee' })) // no self lock-out
  })
  await t.test('workspace board: members read and edit, viewers read only, outsiders see nothing', async () => {
    await assertSucceeds(getDoc(doc(as('wsmember'), 'tasks', 'ws1')))
    await assertSucceeds(getDoc(doc(as('wsviewer'), 'tasks', 'ws1')))
    await assertFails(getDoc(doc(as('outsider'), 'tasks', 'ws1')))
    await assertSucceeds(updateDoc(doc(as('wsmember'), 'tasks', 'ws1'), { title: 'x' }))
    await assertFails(updateDoc(doc(as('wsviewer'), 'tasks', 'ws1'), { title: 'y' }))
    await assertFails(updateDoc(doc(as('wsmember'), 'tasks', 'ws1'), { boardId: 'main' })) // cannot be moved to another board
  })
  await t.test('workspace board: the list query a member runs is allowed, an outsider is refused', async () => {
    await assertSucceeds(getDocs(query(collection(as('wsmember'), 'tasks'), where('boardId', '==', 'B1'))))
    await assertFails(getDocs(query(collection(as('outsider'), 'tasks'), where('boardId', '==', 'B1'))))
  })
  await t.test('columns: only a board admin changes them', async () => {
    await assertSucceeds(updateDoc(doc(as('wsadmin'), 'columns', 'col1'), { name: 'DOING' }))
    await assertFails(updateDoc(doc(as('wsmember'), 'columns', 'col1'), { name: 'NOPE' }))
    await assertSucceeds(getDoc(doc(as('wsviewer'), 'columns', 'col1')))
    await assertFails(getDoc(doc(as('outsider'), 'columns', 'col1')))
  })
  await t.test('boards: a workspace admin creates boards, only a Director may add "main"', async () => {
    const b = { workspaceId: 'W1', name: 'New', createdBy: 'wsadmin', members: {} }
    await assertSucceeds(setDoc(doc(as('wsadmin'), 'boards', 'B2'), b))
    await assertFails(setDoc(doc(as('wsmember'), 'boards', 'B3'), { ...b, createdBy: 'wsmember' }))
    await assertFails(setDoc(doc(as('wsadmin'), 'boards', 'main'), b))
    await assertSucceeds(setDoc(doc(as('director'), 'boards', 'main'), { ...b, createdBy: 'director' }))
  })
  await t.test('workspaces: managers create them, employees cannot, the last admin cannot leave', async () => {
    const w = (uid) => ({ name: 'New', createdBy: uid, members: { [uid]: 'admin' }, memberIds: [uid] })
    await assertSucceeds(setDoc(doc(as('manager'), 'workspaces', 'W2'), w('manager')))
    await assertFails(setDoc(doc(as('it1'), 'workspaces', 'W3'), w('it1')))
    await assertFails(updateDoc(doc(as('wsadmin'), 'workspaces', 'W1'), { members: { wsmember: 'member', wsviewer: 'viewer' }, memberIds: ['wsmember', 'wsviewer'] }))
    await assertFails(updateDoc(doc(as('wsmember'), 'workspaces', 'W1'), { name: 'hacked' }))
  })

  await env.cleanup()
})
