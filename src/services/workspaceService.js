import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, onSnapshot, query, where,
  serverTimestamp, arrayUnion, arrayRemove, deleteField,
} from '@/firebase/sdk'
import { db } from '@/firebase/config'
import { DEFAULT_COLUMNS } from '@/utils/constants'
import { summarizeBoard } from '@/utils/boardStats'

// Workspaces and boards (see docs/MIGRATION_PLAN.md).
//   workspaces/{id}  { name, description, icon, color, archived, createdBy, members: {uid: role}, memberIds: [uid] }
//   boards/{id}      { workspaceId, name, description, background, archived, members: {uid: role} (board-level roles) }
// Employees are the same people as everywhere else: the keys are Firebase Auth uids (= PMS uids), from users/{uid}.
const wsCol = collection(db, 'workspaces')
const boardCol = collection(db, 'boards')
const byName = (a, b) => (a.name ?? '').localeCompare(b.name ?? '')
const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))

// ---------- workspaces ----------
// A Director sees every workspace; everyone else sees the ones they belong to.
// A Director sees every workspace that is not Super Private, plus the Super Private ones they were added to.
// (Two lists, merged: the server never hands out a Super Private workspace to someone it was not shared with.)
export function subscribeWorkspaces({ uid, isAdmin }, onData, onError) {
  const mine = query(wsCol, where('memberIds', 'array-contains', uid))
  if (!isAdmin) return onSnapshot(mine, (snap) => onData(rows(snap).sort(byName)), onError)
  let a = null, b = null
  const emit = () => { if (a && b) onData([...new Map([...a, ...b].map((w) => [w.id, w])).values()].sort(byName)) }
  const stops = [
    onSnapshot(mine, (snap) => { a = rows(snap); emit() }, onError),
    onSnapshot(query(wsCol, where('superPrivate', '==', false)), (snap) => { b = rows(snap); emit() }, onError),
  ]
  return () => stops.forEach((s) => s())
}

export async function createWorkspace(uid, { name, description = '', icon = '', color = 'sage', superPrivate = false }) {
  const ref = doc(wsCol)
  await setDoc(ref, {
    name, description, icon, color, archived: false, superPrivate: superPrivate === true,
    createdBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    members: { [uid]: 'admin' }, memberIds: [uid],
  })
  return ref.id
}

export const updateWorkspace = (id, changes) => updateDoc(doc(db, 'workspaces', id), { ...changes, updatedAt: serverTimestamp() })

// Several people at once: { uid: role }. One write, so the members map and the memberIds list always agree.
export const setMembers = (wid, roles) => updateDoc(doc(db, 'workspaces', wid), {
  ...Object.fromEntries(Object.entries(roles).map(([uid, role]) => [`members.${uid}`, role])),
  memberIds: arrayUnion(...Object.keys(roles)),
  updatedAt: serverTimestamp(),
})
export const removeMember = (wid, uid) => updateDoc(doc(db, 'workspaces', wid), {
  [`members.${uid}`]: deleteField(), memberIds: arrayRemove(uid), updatedAt: serverTimestamp(),
})

// ---------- boards ----------
export const subscribeBoards = (wid, onData, onError) =>
  onSnapshot(query(boardCol, where('workspaceId', '==', wid)), (snap) => onData(rows(snap).sort(byName)), onError)

const COLORS = { 'NEW PROJECT': 'slate', TODO: 'sky', DOING: 'honey', REVIEW: 'plum', DONE: 'sage' }
async function addColumns(boardId, specs) {
  const batch = writeBatch(db)
  specs.forEach((c, i) => batch.set(doc(collection(db, 'columns')), {
    boardId, name: c.name, position: (i + 1) * 1000, isDone: !!c.isDone, color: c.color ?? '', archived: false, limit: c.limit ?? null,
    createdAt: serverTimestamp(),
  }))
  await batch.commit()
}

// Two steps on purpose: the board document first (it decides who may write its columns), then its columns.
// If the second step fails the board still exists and its admin can press "Create default columns".
// `copyFrom` = another board whose COLUMNS and settings are copied (never its tasks).
export async function createBoard(uid, wid, { name, description = '', background = { type: 'color', color: 'sage' }, copyFrom = '', starterColumns = true }) {
  const ref = doc(boardCol)
  await setDoc(ref, {
    workspaceId: wid, name, description, background, archived: false, members: {},
    createdBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
  if (copyFrom) {
    const cols = rows(await getDocs(query(collection(db, 'columns'), where('boardId', '==', copyFrom))))
      .filter((c) => !c.archived).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    if (cols.length) await addColumns(ref.id, cols)
  } else if (starterColumns) {
    await addColumns(ref.id, DEFAULT_COLUMNS.map((name) => ({ name, color: COLORS[name], isDone: name === 'DONE' })))
  }
  return ref.id
}

export const updateBoard = (id, changes) => updateDoc(doc(db, 'boards', id), { ...changes, updatedAt: serverTimestamp() })

// A board-level role for one person (null = back to their workspace role)
export const setBoardRole = (bid, uid, role) => updateDoc(doc(db, 'boards', bid), {
  [`members.${uid}`]: role ?? deleteField(), updatedAt: serverTimestamp(),
})

// Only for an EMPTY board: no tasks. Its (empty) columns go with it.
export async function deleteEmptyBoard(bid) {
  const any = await getDocs(query(collection(db, 'tasks'), where('boardId', '==', bid)))
  if (!any.empty) throw Object.assign(new Error('The board still has tasks'), { code: 'board/not-empty' })
  const cols = await getDocs(query(collection(db, 'columns'), where('boardId', '==', bid)))
  const batch = writeBatch(db)
  cols.forEach((c) => batch.delete(c.ref))
  await batch.commit()
  await deleteDoc(doc(db, 'boards', bid))
}

// Puts the ORIGINAL board ("main", also used by the PMS link) into a workspace. Nothing is copied or moved: the
// tasks keep their IDs and boardId. A Director only (firestore.rules). From then on it follows workspace rules.
export const adoptMainBoard = (uid, wid) => setDoc(doc(db, 'boards', 'main'), {
  workspaceId: wid, name: 'Main board', description: 'The original Widebed task board', background: { type: 'color', color: 'sage' },
  archived: false, members: {}, createdBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
})
export const mainBoardExists = async () => (await getDoc(doc(db, 'boards', 'main'))).exists()

// ---------- starred boards: private to each person ----------
const starsRef = (uid) => doc(db, 'users', uid, 'settings', 'stars')
export const subscribeStars = (uid, onData) => onSnapshot(starsRef(uid), (snap) => onData(snap.data()?.boardIds ?? []), () => onData([]))
export const setStar = (uid, bid, on) => setDoc(starsRef(uid), { boardIds: on ? arrayUnion(bid) : arrayRemove(bid) }, { merge: true })

// ---------- board preview numbers ----------
export async function loadBoardPreview(bid) {
  const [cols, tasks] = await Promise.all([
    getDocs(query(collection(db, 'columns'), where('boardId', '==', bid))),
    getDocs(query(collection(db, 'tasks'), where('boardId', '==', bid))),
  ])
  const columns = rows(cols).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  return summarizeBoard(columns, rows(tasks))
}

// ---------- single documents (the board store listens to the open board and its workspace) ----------
const one = (snap) => (snap.exists() ? { id: snap.id, ...snap.data() } : null)
export const subscribeBoardDoc = (bid, onData, onError) => onSnapshot(doc(db, 'boards', bid), (snap) => onData(one(snap)), onError)
export const subscribeWorkspace = (wid, onData, onError) => onSnapshot(doc(db, 'workspaces', wid), (snap) => onData(one(snap)), onError)
