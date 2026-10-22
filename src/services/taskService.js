import {
  collection, doc, deleteDoc, getDocs, writeBatch, onSnapshot, query, where, serverTimestamp,
} from '@/firebase/sdk'
import { db } from '@/firebase/config'
import { BOARD_ID, DEFAULT_PROJECT_ID } from '@/utils/constants'

const tasksRef = collection(db, 'tasks')
const activitiesRef = collection(db, 'task_activities')

const activity = (taskId, user, action, detail = '') => ({
  taskId, userId: user.id, userName: user.name, action, detail, createdAt: serverTimestamp(),
})

// Admins see every task. Everyone else only sees their own department
// (the same rule is enforced again in firestore.rules).
export function subscribeBoardTasks({ isAdmin, departmentId }, onData, onError) {
  const constraints = [where('boardId', '==', BOARD_ID)]
  if (!isAdmin) constraints.push(where('departmentId', '==', departmentId))
  return onSnapshot(
    query(tasksRef, ...constraints),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.position - b.position)),
    onError,
  )
}

export function subscribeActivity(taskId, onData) {
  return onSnapshot(query(activitiesRef, where('taskId', '==', taskId)), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    items.sort((a, b) => (b.createdAt?.seconds ?? Infinity) - (a.createdAt?.seconds ?? Infinity))
    onData(items)
  })
}

export async function createTask(data, column, position, user) {
  const ref = doc(tasksRef) // stable ID is generated up-front
  const batch = writeBatch(db)
  batch.set(ref, {
    projectId: DEFAULT_PROJECT_ID,
    boardId: BOARD_ID,
    columnId: column.id,
    status: column.name.toUpperCase(),
    position,
    assignedTo: [], subtasks: [], labels: [], attachments: [],
    startDate: null, dueDate: null, estimatedHours: null,
    completedAt: column.isDone ? serverTimestamp() : null,
    ...data,
    createdBy: user.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  batch.set(doc(activitiesRef), activity(ref.id, user, 'created', data.title))
  await batch.commit()
  return ref.id
}

// `changes` = only the fields that changed. `notes` = human-readable lines for the activity log.
export async function updateTask(taskId, changes, notes, user) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'tasks', taskId), { ...changes, updatedAt: serverTimestamp() })
  notes.forEach((n) => batch.set(doc(activitiesRef), activity(taskId, user, 'updated', n)))
  await batch.commit()
}

// Drag & drop: a single write to one document, so two people dragging different cards never collide.
export async function moveTask(task, column, position, user) {
  const columnChanged = task.columnId !== column.id
  const changes = { position, updatedAt: serverTimestamp() }
  if (columnChanged) {
    changes.columnId = column.id
    changes.status = column.name.toUpperCase()
    changes.completedAt = column.isDone ? serverTimestamp() : null
  }
  const batch = writeBatch(db)
  batch.update(doc(db, 'tasks', task.id), changes)
  if (columnChanged) batch.set(doc(activitiesRef), activity(task.id, user, 'moved', `to ${column.name}`))
  await batch.commit()
}

export const deleteTask = (taskId) => deleteDoc(doc(db, 'tasks', taskId))

// Used before deleting a column: moves ALL of its tasks (any department) to another column.
// Task IDs, assignees and dates are untouched. Only the column, status and position change.
export async function moveAllTasks(from, to, user) {
  const [src, dst] = await Promise.all([
    getDocs(query(tasksRef, where('columnId', '==', from.id))),
    getDocs(query(tasksRef, where('columnId', '==', to.id))),
  ])
  let pos = dst.docs.reduce((m, d) => Math.max(m, d.data().position ?? 0), 0)
  const docs = [...src.docs].sort((a, b) => (a.data().position ?? 0) - (b.data().position ?? 0))
  for (let i = 0; i < docs.length; i += 200) { // a batch holds at most 500 writes
    const batch = writeBatch(db)
    docs.slice(i, i + 200).forEach((d) => {
      pos += 1000
      batch.update(d.ref, {
        columnId: to.id, status: to.name.toUpperCase(), position: pos,
        completedAt: to.isDone ? d.data().completedAt ?? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      })
      batch.set(doc(activitiesRef), activity(d.id, user, 'moved', `to ${to.name}`))
    })
    await batch.commit()
  }
  return docs.length
}
