import {
  collection, doc, addDoc, updateDoc, deleteDoc, writeBatch, onSnapshot, query, where, serverTimestamp,
} from '@/firebase/sdk'
import { db } from '@/firebase/config'
import { DEFAULT_COLUMNS } from '@/utils/constants'
import { byPosition } from '@/utils/ordering'

const colRef = collection(db, 'columns')

export function subscribeColumns(boardId, onData, onError) {
  const q = query(colRef, where('boardId', '==', boardId))
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byPosition)),
    onError,
  )
}

const COLORS = { 'NEW PROJECT': 'slate', TODO: 'sky', DOING: 'honey', REVIEW: 'plum', DONE: 'sage' }

export const createColumn = (boardId, name, position) =>
  addDoc(colRef, { boardId, name, position, isDone: false, color: '', archived: false, limit: null, createdAt: serverTimestamp() })

// color, archived, limit and isDone are optional on older columns; missing means "not set".
export const updateColumn = (id, changes) => updateDoc(doc(db, 'columns', id), changes)

// Dragging a column rewrites every position in one batch, so the order is always unique and stable.
export async function reorderColumns(orderedIds) {
  const batch = writeBatch(db)
  orderedIds.forEach((id, i) => batch.update(doc(db, 'columns', id), { position: (i + 1) * 1000 }))
  await batch.commit()
}

export async function seedDefaultColumns(boardId) {
  const batch = writeBatch(db)
  DEFAULT_COLUMNS.forEach((name, i) => {
    batch.set(doc(colRef), {
      boardId, name, position: (i + 1) * 1000, isDone: name === 'DONE', color: COLORS[name], archived: false, limit: null, createdAt: serverTimestamp(),
    })
  })
  await batch.commit()
}

// Renaming also refreshes the `status` label on the tasks the person can see (`taskIds`).
// `columnId` is the real link between a task and its column; `status` is a copy kept for reports.
export async function renameColumn(column, name, taskIds = []) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'columns', column.id), { name })
  taskIds.forEach((id) => batch.update(doc(db, 'tasks', id), { status: name.toUpperCase() }))
  await batch.commit()
}

export const deleteColumn = (id) => deleteDoc(doc(db, 'columns', id))
