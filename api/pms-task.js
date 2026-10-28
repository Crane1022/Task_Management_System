// POST /api/pms-task   Authorization: Bearer <PMS ID token>   { action, taskId?, data }
// Messages from the Widebed PMS. PMS uids are TMS uids (staff sign in to the TMS through /api/pms-login).
//
//   create  Director only.  data: title, details, assigneeUids[], dueDate 'YYYY-MM-DD', departmentId, priority,
//           subtasks ['text', ...], pmsLink { type, id }                                 -> { ok, taskId }
//   update  Director, an assignee, or a same-department Procurement user.  taskId, data: text (a note),
//           completed true/false, subtasks [{ id, done }] (tick checklist items) or
//           subtasks [{ title, done }] (the whole checklist, ids kept for matching titles) -> { ok, status, completed }
//   list    Any active PMS staff.  data: { type, id } (the pmsLink)                      -> { ok, tasks: [...] }
//   inbox   Director or Procurement.  Open tasks of the caller's department (a Director sends data.departmentId)
//           not yet linked to a PMS record, up to 50                                     -> { ok, tasks: [...] }
//   link    Director, or a user whose department is the task's.  taskId, data: { pmsLink: { type, id } }
//           Refused when the task is linked to something else already                    -> { ok, taskId, pmsKey }
import { randomUUID } from 'node:crypto'
import { addActivities } from './_lib/activity.js'
import { getServices, handle, pmsUser, readPmsDoc, staffFrom, bodyOf, text, HttpError, DEPARTMENT_IDS, DEPT_FOR_PMS_ROLE } from './_lib/pms.js'

const BOARD_ID = 'main' // src/utils/constants.js BOARD_ID
const DEFAULT_PROJECT_ID = 'general'
const PRIORITIES = ['low', 'medium', 'high', 'urgent']
const STEP = 1000 // gap between card positions, as on the board
const UID = /^[A-Za-z0-9_-]{1,128}$/
const LINK_TYPE = /^[A-Za-z0-9_-]{1,40}$/

const pmsKey = (link) => `${link.type}:${link.id}`
// PMS roles that may work the tasks of their own department from the PMS without being an assignee
const DEPT_SYNC_ROLES = ['procurement']
// PMS roles with a task inbox in the PMS (tasks of their department not yet linked to a PMS record)
const INBOX_ROLES = ['director', 'procurement']
const INBOX_LIMIT = 50
const myDept = (me) => DEPT_FOR_PMS_ROLE[me.role] || null

// Due dates are saved as midnight Malaysia time, like the date input on the board (fromInput in src/utils/dates.js)
function dueFrom(s, Timestamp) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null
  const d = new Date(`${s}T00:00:00+08:00`)
  return Number.isNaN(d.getTime()) ? null : Timestamp.fromDate(d)
}
const iso = (ts) => ts?.toDate?.().toISOString() ?? null

function linkFrom(v) {
  if (!v) return null
  const type = text(v.type, 40), id = text(v.id, 100)
  if (!LINK_TYPE.test(type) || !id) throw new HttpError(400, 'pmsLink needs a type (letters, digits, - or _) and an id')
  return { type, id }
}

// Columns of the board in order. The first open column is where new tasks go, like the "New task" button.
async function boardColumns(db) {
  const snap = await db.collection('columns').where('boardId', '==', BOARD_ID).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
}
async function endPosition(db, columnId) {
  const snap = await db.collection('tasks').where('columnId', '==', columnId).get()
  return snap.docs.reduce((m, d) => Math.max(m, d.data().position ?? 0), 0) + STEP
}
// Moves a task forward to the open column with this name (e.g. 'todo', 'doing'), never backwards: a task already in
// that column or a later one stays where it is. Returns the changes to write, or null.
async function forwardTo(db, t, name) {
  if (t.completedAt) return null
  const columns = await boardColumns(db)
  const want = name.replace(/\s/g, '').toLowerCase()
  const target = columns.find((c) => !c.archived && !c.isDone && String(c.name).replace(/\s/g, '').toLowerCase() === want)
  const here = columns.find((c) => c.id === t.columnId)
  if (!target || target.id === t.columnId || (here && (here.position ?? 0) >= (target.position ?? 0))) return null
  return { columnId: target.id, status: target.name.toUpperCase(), position: await endPosition(db, target.id), columnName: target.name }
}
// A batch that fails because the task changed since it was read means two people saved at the same moment: ask to try again
async function commitOrConflict(batch) {
  try { await batch.commit() } catch (e) {
    if (e?.code === 9 || e?.code === 'failed-precondition') throw new HttpError(409, 'The task was changed at the same moment. Please try again.')
    throw e
  }
}

// Each assignee needs a TMS profile so the board can show their name. Someone who has never signed in to the
// TMS gets a placeholder profile from their PMS staff record (Directors can read every PMS staff record).
async function ensureAssignees(db, FieldValue, me, uids) {
  const profiles = []
  for (const uid of uids) {
    const ref = db.collection('users').doc(uid)
    const snap = await ref.get()
    if (snap.exists) { profiles.push(snap.data()); continue }
    const fields = await readPmsDoc(`users/${uid}`, me.idToken)
    const s = fields && staffFrom(fields)
    if (!s || !s.active || !s.role) throw new HttpError(400, `Unknown or switched-off PMS staff: ${uid}`)
    const profile = { name: s.name || s.email || 'PMS staff', email: s.email, role: s.role === 'director' ? 'super_admin' : 'employee', departmentId: DEPT_FOR_PMS_ROLE[s.role] ?? null, pmsRole: s.role, stub: true, createdAt: FieldValue.serverTimestamp() }
    await ref.set(profile)
    profiles.push(profile)
  }
  return profiles
}

async function create(me, data) {
  if (me.role !== 'director') throw new HttpError(403, 'Only Directors create tasks')
  const { db, FieldValue, Timestamp } = getServices()

  const title = text(data.title, 200)
  if (!title) throw new HttpError(400, 'Give the task a title')
  const uids = [...new Set(Array.isArray(data.assigneeUids) ? data.assigneeUids.map(String) : [])]
  if (uids.length > 10 || uids.some((u) => !UID.test(u))) throw new HttpError(400, 'assigneeUids must be up to 10 PMS uids')
  const subtasks = (Array.isArray(data.subtasks) ? data.subtasks : []).slice(0, 50)
    .map((s) => text(s, 200)).filter(Boolean)
    .map((title) => ({ id: randomUUID(), title, done: false })) // same shape as TaskModal's checklist items
  const pmsLink = linkFrom(data.pmsLink)

  const columns = (await boardColumns(db)).filter((c) => !c.archived)
  const column = columns[0]
  if (!column) throw new HttpError(409, 'The task board has no columns yet')

  const assignees = await ensureAssignees(db, FieldValue, me, uids)
  // Department: as sent, else the first assignee's, else guessed from their PMS role, else Management
  const departmentId = DEPARTMENT_IDS.includes(data.departmentId) ? data.departmentId
    : assignees[0]?.departmentId || DEPT_FOR_PMS_ROLE[assignees[0]?.pmsRole] || 'management'

  const now = FieldValue.serverTimestamp()
  const ref = db.collection('tasks').doc()
  const batch = db.batch()
  batch.set(ref, {
    projectId: DEFAULT_PROJECT_ID,
    boardId: BOARD_ID,
    columnId: column.id,
    status: column.name.toUpperCase(),
    position: await endPosition(db, column.id),
    title,
    description: text(data.details, 5000),
    category: '',
    departmentId,
    priority: PRIORITIES.includes(data.priority) ? data.priority : 'medium',
    assignedTo: uids, subtasks, labels: ['PMS'], attachments: [],
    startDate: null, dueDate: dueFrom(data.dueDate, Timestamp), estimatedHours: null,
    completedAt: column.isDone ? now : null,
    pmsLink, pmsKey: pmsLink ? pmsKey(pmsLink) : null, source: 'pms',
    createdBy: me.uid, createdByName: me.name,
    createdAt: now, updatedAt: now,
    activitySeq: 1,
  })
  addActivities(db, FieldValue, batch, ref.id, 0, me, [['created', `${title} (from the PMS)`]]) // record number 1 of this task
  await batch.commit()
  return { ok: true, taskId: ref.id }
}

async function update(me, taskId, data) {
  const { db, FieldValue } = getServices()
  if (!taskId || typeof taskId !== 'string' || taskId.includes('/')) throw new HttpError(400, 'taskId is missing')
  const ref = db.collection('tasks').doc(taskId)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpError(404, 'No such task')
  const t = snap.data()
  const sameDept = DEPT_SYNC_ROLES.includes(me.role) && !!t.departmentId && myDept(me) === t.departmentId
  // A New Owner Listing task moves to Marketing, then Operations, as the listing goes on; Procurement keeps it in sync
  const listingTask = me.role === 'procurement' && t.pmsLink?.type === 'newOwnerListing'
  if (me.role !== 'director' && !(t.assignedTo || []).includes(me.uid) && !sameDept && !listingTask) throw new HttpError(403, 'Not your task')

  const now = FieldValue.serverTimestamp()
  const changes = {}
  const logs = []
  const note = text(data.text, 2000)
  if (note) logs.push(['commented', `"${note}" (from the PMS)`])

  const fullSync = Array.isArray(data.subtasks) && data.subtasks.length > 0
    && data.subtasks.every((s) => s && typeof s.title === 'string' && !('id' in s))
  if (fullSync) {
    // The whole checklist as the PMS has it: same order, ids kept for titles that were there before
    const old = t.subtasks || []
    const used = new Set()
    const next = data.subtasks.slice(0, 50).map((s) => ({ title: text(s.title, 200), done: !!s.done })).filter((s) => s.title)
      .map((s) => {
        const hit = old.find((o) => o.title === s.title && !used.has(o.id))
        if (hit) used.add(hit.id)
        return { ...(hit || {}), id: hit?.id || randomUUID(), title: s.title, done: s.done }
      })
    const same = next.length === old.length && next.every((s, i) => s.id === old[i].id && s.done === !!old[i].done)
    if (!same) {
      changes.subtasks = next
      logs.push(['updated', `checklist synced from the PMS (${next.filter((s) => s.done).length} of ${next.length} done)`])
    }
  } else if (Array.isArray(data.subtasks) && data.subtasks.length) {
    const want = new Map(data.subtasks.map((s) => [String(s?.id), !!s?.done]))
    const next = (t.subtasks || []).map((s) => (want.has(s.id) ? { ...s, done: want.get(s.id) } : s))
    const ticked = next.filter((s, i) => s.done !== (t.subtasks[i].done ?? false))
    if (ticked.length) { changes.subtasks = next; logs.push(['updated', `checklist (${ticked.map((s) => s.title).join(', ')})`]) }
  }

  // started: work has begun in the PMS (the service agreement is signed or skipped) -> DOING, never backwards
  if (data.started === true && data.completed !== true) {
    const move = await forwardTo(db, t, 'doing')
    if (move) {
      const { columnName, ...c } = move
      Object.assign(changes, c)
      logs.push(['moved', `to ${columnName} (work started in the PMS)`])
    }
  }

  // departmentId: hand the task to another department (e.g. marketing after payment, operation when live)
  if (data.departmentId !== undefined) {
    if (!DEPARTMENT_IDS.includes(data.departmentId)) throw new HttpError(400, 'Unknown department')
    if (data.departmentId !== t.departmentId) {
      changes.departmentId = data.departmentId
      logs.push(['updated', `department to ${data.departmentId} (from the PMS)`])
    }
  }

  if (typeof data.completed === 'boolean' && data.completed !== !!t.completedAt) {
    const columns = await boardColumns(db)
    const open = columns.filter((c) => !c.archived)
    // Completed -> the done column; reopened -> the first open column that is not a done column
    const target = data.completed
      ? open.find((c) => c.isDone) || columns.find((c) => c.isDone)
      : open.find((c) => !c.isDone)
    if (target && target.id !== t.columnId) {
      Object.assign(changes, { columnId: target.id, status: target.name.toUpperCase(), position: await endPosition(db, target.id) })
      logs.push(['moved', `to ${target.name} (from the PMS)`])
    } else {
      logs.push(['updated', data.completed ? 'marked completed (from the PMS)' : 'reopened (from the PMS)'])
    }
    changes.completedAt = data.completed ? now : null
  }

  if (!logs.length) {
    // A checklist that already matches is not an error for a sync
    if (fullSync) return { ok: true, status: t.status, completed: !!t.completedAt }
    throw new HttpError(400, 'Nothing to update: send text, completed or subtasks')
  }
  const batch = db.batch()
  const activitySeq = addActivities(db, FieldValue, batch, taskId, t.activitySeq, me, logs)
  // only if nobody changed the task since it was read here, so two writers can never claim the same activity record
  batch.update(ref, { ...changes, activitySeq, updatedAt: now }, snap.updateTime ? { lastUpdateTime: snap.updateTime } : undefined)
  await commitOrConflict(batch)
  const completed = 'completedAt' in changes ? !!data.completed : !!t.completedAt
  return { ok: true, status: changes.status || t.status, completed }
}

async function list(me, data) {
  const { db } = getServices()
  const link = linkFrom(data)
  if (!link) throw new HttpError(400, 'Send the pmsLink type and id')
  const snap = await db.collection('tasks').where('pmsKey', '==', pmsKey(link)).limit(50).get()
  const tasks = snap.docs.map((d) => {
    const t = d.data()
    const subs = t.subtasks || []
    return {
      id: d.id, title: t.title, status: t.status, completed: !!t.completedAt, departmentId: t.departmentId || null,
      subtasksDone: subs.filter((s) => s.done).length, subtasksTotal: subs.length,
      assigneeUids: t.assignedTo || [], dueDate: iso(t.dueDate), completedAt: iso(t.completedAt),
      createdAt: iso(t.createdAt), updatedAt: iso(t.updatedAt),
    }
  }).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
  return { ok: true, tasks }
}

async function inbox(me, data) {
  if (!INBOX_ROLES.includes(me.role)) throw new HttpError(403, 'No task inbox for this role')
  const { db } = getServices()
  const departmentId = me.role === 'director' ? (DEPARTMENT_IDS.includes(data.departmentId) ? data.departmentId : 'procurement') : myDept(me)
  // Tasks made on the board have no pmsKey field at all, so the unlinked ones are picked out here, not in the query
  const snap = await db.collection('tasks').where('departmentId', '==', departmentId).limit(500).get()
  const tasks = snap.docs.map((d) => ({ id: d.id, t: d.data() }))
    .filter(({ t }) => !t.pmsKey && !t.completedAt && !t.archived)
    .map(({ id, t }) => ({
      id, title: t.title || '', description: t.description || '', status: t.status || '', priority: t.priority || 'medium',
      departmentId: t.departmentId, dueDate: iso(t.dueDate), createdAt: iso(t.createdAt), createdByName: t.createdByName || '',
      subtasksTotal: (t.subtasks || []).length,
    }))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    .slice(0, INBOX_LIMIT)
  return { ok: true, departmentId, tasks }
}

async function link(me, taskId, data) {
  const { db, FieldValue } = getServices()
  if (!taskId || typeof taskId !== 'string' || taskId.includes('/')) throw new HttpError(400, 'taskId is missing')
  const pmsLink = linkFrom(data.pmsLink)
  if (!pmsLink) throw new HttpError(400, 'Send the pmsLink type and id')
  const ref = db.collection('tasks').doc(taskId)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpError(404, 'No such task')
  const t = snap.data()
  if (me.role !== 'director' && !(t.departmentId && myDept(me) === t.departmentId)) throw new HttpError(403, 'Not a task of your department')
  const key = pmsKey(pmsLink)
  if (t.pmsKey && t.pmsKey !== key) throw new HttpError(409, `This task is linked to ${t.pmsKey} already`)
  if (t.pmsKey === key) return { ok: true, taskId, pmsKey: key }
  const now = FieldValue.serverTimestamp()
  // Accepted by the team in the PMS (Start listing): a task still in NEW PROJECT moves to TO DO
  const move = await forwardTo(db, t, 'todo')
  const { columnName, ...moved } = move || {}
  const batch = db.batch()
  const logs = [['updated', `linked to ${pmsLink.id} in the PMS`]]
  if (move) logs.push(['moved', `to ${columnName} (accepted in the PMS)`])
  const activitySeq = addActivities(db, FieldValue, batch, taskId, t.activitySeq, me, logs)
  batch.update(ref, { pmsLink, pmsKey: key, labels: [...new Set([...(t.labels || []), 'PMS'])], ...moved, activitySeq, updatedAt: now }, snap.updateTime ? { lastUpdateTime: snap.updateTime } : undefined)
  await commitOrConflict(batch)
  return { ok: true, taskId, pmsKey: key }
}

export default handle(async (req) => {
  const me = await pmsUser(req)
  const { action, taskId, data = {} } = bodyOf(req)
  if (action === 'create') return create(me, data || {})
  if (action === 'update') return update(me, taskId, data || {})
  if (action === 'list') return list(me, data || {})
  if (action === 'inbox') return inbox(me, data || {})
  if (action === 'link') return link(me, taskId, data || {})
  throw new HttpError(400, 'Unknown action')
})