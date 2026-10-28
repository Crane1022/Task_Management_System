import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, writeBatch, runTransaction, onSnapshot, query, where, serverTimestamp,
} from '@/firebase/sdk'
import { db } from '@/firebase/config'
import { BOARD_ID, DEFAULT_PROJECT_ID, displayOf } from '@/utils/constants'
import { byPosition } from '@/utils/ordering'
import { activityId, newest, staleLegacy, summarize } from '@/utils/activity'
import { MAX_ATTACHMENTS } from '@/utils/links'

const tasksRef = collection(db, 'tasks')
const activitiesRef = collection(db, 'task_activities')
const commentsRef = (taskId) => collection(db, 'tasks', taskId, 'comments')
const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))

// ---------- activity: at most 15 records per task ----------
// Record number `seq` of a task is saved as document "<taskId>_<(seq-1) % 15>", so there are never more than 15, and the
// 16th replaces the oldest. The task's own counter `activitySeq` goes up by one in the SAME write; firestore.rules checks both.
const record = (taskId, seq, user, action, detail = '') => ({
  taskId, seq, userId: user.id, userName: displayOf(user), action, detail, createdAt: serverTimestamp(),
})
const recordRef = (taskId, seq) => doc(db, 'task_activities', activityId(taskId, seq))

// Reads the task, then saves the change AND its activity record together. If somebody else saved the task in between,
// Firestore runs this again with the fresh data, so two people editing at the same moment never lose a record.
// build(task) -> { changes, note: { action, detail } | null }
function changeTask(taskId, build, user) {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, 'tasks', taskId)
    const snap = await tx.get(ref)
    if (!snap.exists()) throw Object.assign(new Error('This task no longer exists.'), { code: 'task/gone' })
    const task = { id: snap.id, ...snap.data() }
    const { changes, note } = build(task)
    const write = { ...changes, updatedAt: serverTimestamp() }
    if (note) {
      const seq = (task.activitySeq ?? 0) + 1
      write.activitySeq = seq
      tx.set(recordRef(taskId, seq), record(taskId, seq, user, note.action, note.detail))
    }
    tx.update(ref, write)
    return task
  })
}

// ---------- listing ----------
// A workspace board (it has a board document): everyone who may open it sees all of its tasks.
// The original board (`legacy`): admins see every task; everyone else sees their own department, plus any task they
// are assigned to (PMS tasks can be assigned across departments). The same rules are enforced again in firestore.rules.
export function subscribeBoardTasks({ boardId = BOARD_ID, legacy = true, isAdmin, departmentId, uid }, onData, onError) {
  const sorted = (list) => list.sort(byPosition)
  if (isAdmin || !legacy) return onSnapshot(query(tasksRef, where('boardId', '==', boardId)), (snap) => onData(sorted(rows(snap))), onError)

  let dept = null, mine = null // both listeners must answer before the first onData
  const emit = () => {
    if (!dept || !mine) return
    const byId = new Map([...dept, ...mine.filter((t) => t.boardId === boardId)].map((t) => [t.id, t]))
    onData(sorted([...byId.values()]))
  }
  const stops = [
    onSnapshot(query(tasksRef, where('boardId', '==', boardId), where('departmentId', '==', departmentId)), (snap) => { dept = rows(snap); emit() }, onError),
    // boardId is part of this query too, so the server can see which board these tasks are on (see firestore.rules)
    onSnapshot(query(tasksRef, where('boardId', '==', boardId), where('assignedTo', 'array-contains', uid)), (snap) => { mine = rows(snap); emit() }, onError),
  ]
  return () => stops.forEach((s) => s())
}

// The activity of one task, newest first, never more than 15. Records from before the limit existed that are beyond the
// newest 15 are deleted (once per task per session, if the person is allowed to).
const cleaned = new Set()
export function subscribeActivity(taskId, onData) {
  return onSnapshot(query(activitiesRef, where('taskId', '==', taskId)), (snap) => {
    const items = rows(snap)
    onData(newest(items))
    const stale = staleLegacy(items)
    if (stale.length && !cleaned.has(taskId)) {
      cleaned.add(taskId)
      stale.forEach((a) => deleteDoc(doc(db, 'task_activities', a.id)).catch(() => {}))
    }
  }, () => onData([]))
}

// ---------- writing tasks ----------
// `workspaceId` = the workspace of the board the task is created on (null on the original board)
export async function createTask(data, column, position, user, workspaceId = null) {
  const ref = doc(tasksRef) // stable ID is generated up-front
  const batch = writeBatch(db)
  batch.set(ref, {
    projectId: DEFAULT_PROJECT_ID,
    boardId: column.boardId ?? BOARD_ID,
    workspaceId,
    columnId: column.id,
    status: column.name.toUpperCase(),
    position,
    assignedTo: [], subtasks: [], labels: [], attachments: [],
    startDate: null, dueDate: null, estimatedHours: null,
    completedAt: column.isDone ? serverTimestamp() : null,
    ...data,
    createdBy: user.id,
    activitySeq: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  batch.set(recordRef(ref.id, 1), record(ref.id, 1, user, 'created', data.title))
  await batch.commit()
  return ref.id
}

// `changes` = only the fields that changed. `notes` = human-readable lines for the activity log (saved as ONE record).
export function updateTask(taskId, changes, notes, user) {
  const detail = summarize(notes)
  return changeTask(taskId, () => ({ changes, note: detail ? { action: 'updated', detail } : null }), user)
}

// Drag & drop. Changing column also writes an activity record; a drop inside the same column only changes the position.
export async function moveTask(task, column, position, user) {
  if (task.columnId === column.id) { await updateDoc(doc(db, 'tasks', task.id), { position, updatedAt: serverTimestamp() }); return }
  await changeTask(task.id, () => ({
    changes: { position, columnId: column.id, status: column.name.toUpperCase(), completedAt: column.isDone ? serverTimestamp() : null },
    note: { action: 'moved', detail: `to ${column.name}` },
  }), user)
}

// Moves a task to a column of ANOTHER board or workspace. It is the same task record (same ID), so it leaves the old board
// and appears on the new one without a copy. `dest` = { boardId, workspaceId, label }.
export async function moveTaskToBoard(task, dest, column, position, user) {
  await changeTask(task.id, (current) => ({
    changes: {
      boardId: dest.boardId, workspaceId: dest.workspaceId ?? null, columnId: column.id, status: column.name.toUpperCase(), position,
      completedAt: column.isDone ? current.completedAt ?? serverTimestamp() : null,
    },
    note: { action: 'moved', detail: `to ${dest.label} › ${column.name}` },
  }), user)
}

// Deletes the task together with its activity and comments (they would otherwise stay behind unreachable)
export async function deleteTask(taskId) {
  const [acts, comments] = await Promise.all([
    getDocs(query(activitiesRef, where('taskId', '==', taskId))).catch(() => ({ docs: [] })),
    getDocs(commentsRef(taskId)).catch(() => ({ docs: [] })),
  ])
  const refs = [...acts.docs, ...comments.docs].map((d) => d.ref)
  const first = writeBatch(db)
  first.delete(doc(db, 'tasks', taskId))
  refs.slice(0, 400).forEach((r) => first.delete(r))
  await first.commit()
  for (let i = 400; i < refs.length; i += 450) { // a very long discussion: the rest follows (the task is gone, so this is allowed)
    const b = writeBatch(db)
    refs.slice(i, i + 450).forEach((r) => b.delete(r))
    await b.commit()
  }
}

// Used before deleting a column: moves ALL of its tasks (any department) to another column.
// Task IDs, assignees and dates are untouched. Only the column, status and position change.
export async function moveAllTasks(from, to, user) {
  const [src, dst] = await Promise.all([
    // boardId is part of the query so Firestore can check access to the board (see firestore.rules)
    getDocs(query(tasksRef, where('boardId', '==', from.boardId ?? BOARD_ID), where('columnId', '==', from.id))),
    getDocs(query(tasksRef, where('boardId', '==', to.boardId ?? BOARD_ID), where('columnId', '==', to.id))),
  ])
  let pos = dst.docs.reduce((m, d) => Math.max(m, d.data().position ?? 0), 0)
  const docs = [...src.docs].sort((a, b) => (a.data().position ?? 0) - (b.data().position ?? 0))
  // a few tasks per batch: the security rules look at each task and its activity record, and a batch may only make 20 such lookups
  for (let i = 0; i < docs.length; i += 3) {
    const batch = writeBatch(db)
    docs.slice(i, i + 3).forEach((d) => {
      const t = d.data()
      const seq = (t.activitySeq ?? 0) + 1
      pos += 1000
      batch.update(d.ref, {
        columnId: to.id, status: to.name.toUpperCase(), position: pos,
        completedAt: to.isDone ? t.completedAt ?? serverTimestamp() : null,
        activitySeq: seq, updatedAt: serverTimestamp(),
      })
      batch.set(recordRef(d.id, seq), record(d.id, seq, user, 'moved', `to ${to.name}`))
    })
    await batch.commit()
  }
  return docs.length
}

// ---------- attachments: links to files kept elsewhere (nothing is uploaded) ----------
export function addAttachment(taskId, attachment, user) {
  return changeTask(taskId, (task) => {
    const list = task.attachments ?? []
    if (list.length >= MAX_ATTACHMENTS) throw Object.assign(new Error(`A task can have up to ${MAX_ATTACHMENTS} attachments.`), { code: 'attachments/limit' })
    if (list.some((a) => a.url === attachment.url)) throw Object.assign(new Error('That link is already attached.'), { code: 'attachments/duplicate' })
    return { changes: { attachments: [...list, attachment] }, note: { action: 'attached', detail: attachment.name } }
  }, user)
}
export function removeAttachment(taskId, attachmentId, user) {
  return changeTask(taskId, (task) => {
    const list = task.attachments ?? []
    const gone = list.find((a) => a.id === attachmentId)
    if (!gone) throw Object.assign(new Error('That attachment was already removed.'), { code: 'attachments/gone' })
    return { changes: { attachments: list.filter((a) => a.id !== attachmentId) }, note: { action: 'removed an attachment', detail: gone.name } }
  }, user)
}

// ---------- comments: tasks/{taskId}/comments/{id}, readable only by people who can read the task ----------
export function subscribeComments(taskId, onData, onError) {
  return onSnapshot(commentsRef(taskId), (snap) => {
    onData(rows(snap).sort((a, b) => (a.createdAt?.seconds ?? Infinity) - (b.createdAt?.seconds ?? Infinity)))
  }, onError)
}
// `mentions` = ids of the people tagged with @ (left out when nobody is tagged)
export const addComment = (taskId, text, user, mentions = []) =>
  addDoc(commentsRef(taskId), {
    text: text.trim(), userId: user.id, userName: displayOf(user), createdAt: serverTimestamp(), ...(mentions.length ? { mentions } : {}),
  })
export const editComment = (taskId, commentId, text) =>
  updateDoc(doc(db, 'tasks', taskId, 'comments', commentId), { text: text.trim(), editedAt: serverTimestamp() })
export const deleteComment = (taskId, commentId) => deleteDoc(doc(db, 'tasks', taskId, 'comments', commentId))
