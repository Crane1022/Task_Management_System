// action 'issue' of /api/pms-task: keeps one PMS ticket (issues/IS-0001) and its TMS task in the Maintenance workspace
// the same. See docs/PMS_LINK.md, "Maintenance tickets", and api/_lib/issueStatus.js for the status <-> column mapping.
//
// The PMS calls it after every change to a ticket (raised, in progress, completed, tags, title or description, deleted).
// It sends only the ticket number: the ticket itself is read here from the PMS with the CALLER's token, so the PMS rules
// decide whether they may see it, and nothing the caller sends can change what is copied.
//
//   - Only CUSTOMER tickets come to the TMS. In-house tickets (office, staff or company matters) stay in the PMS, and a
//       ticket changed to In-house has its task removed (it comes back if changed to Customer again).
//   - No task yet and the Customer ticket is open or in progress (whatever roles are tagged):
//       a task is made on the board of the ticket's property in the Maintenance workspace (found by PMS property ID,
//       then by name). A PMS property with no board yet gets one (12 Nov 2026, Khairul): named after the property, with
//       the columns TODO, DOING and DONE (see makeBoard). A ticket with no property, or a typed name that is
//       not a PMS property, is still refused with the reason (the PMS shows it).
//   - The ticket's property changed in the PMS: its task moves to that property's board.
//   - A task already: its title, description and column follow the ticket. A column is only changed when the ticket's
//       status differs from what the card's column stands for, so a card in a column you added (e.g. WAITING PARTS)
//       stays there while the ticket is In progress.
//   - People (18 Nov 2026): the card's Assigned to follows the ticket's raiser (raisedByUid) + assigneeUids; department
//     "Maintenance" when that department exists; the ticket's files (ticket + comments) are the card's attachments; the ticket's comments are copied to the card (one way). Before: the card's Assigned to followed only the ticket's assigneeUids (the PMS "People" picker). Someone with
//       no TMS profile gets a placeholder profile (ensureAssignees); someone who can't be found is left off, the rest still sync.
//   - Deleted in the PMS: the task is deleted here too, with its activity records and comments (the PMS keeps the ticket,
//       marked deleted with its reason, in its audit log).
import { addActivities } from './_lib/activity.js'
import { createHash } from 'node:crypto'
import { getServices, readPmsDoc, listPmsDocs, text, HttpError } from './_lib/pms.js'
import { ensureAssignees } from './_lib/assignees.js'
import { boardColumns, endPosition, commitOrConflict } from './_lib/board.js'
import {
  ISSUE_ID, ISSUE_LINK_TYPE, issueKey, issueTaskId, issueDepartment, MAINTENANCE_WORKSPACE,
  sameBoardName, pmsStatusOfColumn, columnForPmsStatus,
} from './_lib/issueStatus.js'

const DEFAULT_PROJECT_ID = 'general'
const UID = /^[A-Za-z0-9_-]{1,128}$/

// The ticket's people who have (or now get) a TMS profile. One that can't be found or is switched off is left out and logged,
// so one bad uid never stops the sync. (18 Nov 2026)
async function assigneesFor(db, FieldValue, me, uids) {
  const ok = []
  for (const uid of uids) {
    try { await ensureAssignees(db, FieldValue, me, [uid]); ok.push(uid) } catch (e) { console.warn(`[pms-issues] assignee ${uid} left off:`, e.message) }
  }
  return ok
}
// Assigned to = the person who raised the ticket plus its People (Khairul, 18 Nov 2026)
const peopleOf = (issue) => [...new Set([issue.raisedByUid, ...issue.assigneeUids].filter(Boolean))]
// Customer ticket cards go in the department named "Maintenance" (the PMS custom role's department, made by pms-login /
// staff sync). If there is none yet, the old choice (issueDepartment: Procurement or Operations) is kept. (18 Nov 2026)
async function maintenanceDepartment(db) {
  try {
    const snap = await db.collection('departments').get()
    const d = snap.docs.find((x) => String(x.data().name ?? '').trim().toLowerCase() === 'maintenance' && !x.data().gone)
    return d ? d.id : null
  } catch (e) { console.warn('[pms-issues] departments not readable:', e.message); return null }
}
// The ticket's files (Google Drive links on the ticket and on its comments) as card attachments, so one click opens the
// file itself (Khairul, 18 Nov 2026). Each gets a fixed id from its link (pms-f-...), so it is added once; the TMS keeps
// at most 30 attachments, files past that are left off. Attachments people add in the TMS are never touched.
const DRIVE_LINK = /^https:\/\/(drive|docs)\.google\.com\//
const IMAGE = /\.(jpe?g|png|gif|webp|heic|bmp)$/i
const fileAttId = (url) => `pms-f-${createHash('sha1').update(url).digest('hex').slice(0, 16)}`
const fileAttachment = (f, me) => ({
  id: fileAttId(f.url), name: f.name, url: f.url, provider: 'Google Drive', kind: IMAGE.test(f.name) ? 'image' : /\.pdf$/i.test(f.name) ? 'pdf' : 'other',
  addedBy: me.uid, addedByName: me.name ?? '', addedAt: Date.now(),
})
const filesFrom = (list) => (Array.isArray(list) ? list : [])
  .filter((l) => l && typeof l.url === 'string' && DRIVE_LINK.test(l.url) && l.url.length <= 2000)
  .map((l) => ({ name: text(typeof l.name === 'string' && l.name.trim() ? l.name : 'Drive file', 120), url: l.url }))
// The ticket's comments (PMS issues/{id}/replies), read as the caller, oldest first: [{ id, by, byUid, text, links, at, createdAt }]
async function pmsReplies(id, me) {
  return (await listPmsDocs(`issues/${id}/replies`, me.idToken)).map((d) => ({ id: d.id, ...(plain({ mapValue: { fields: d.fields } }) || {}) }))
    .filter((r) => /^[A-Za-z0-9_-]{1,100}$/.test(r.id))
    .sort((a, b) => String(a.createdAt ?? a.at ?? '').localeCompare(String(b.createdAt ?? b.at ?? '')))
}
// The ticket's own files, then its comments' files (oldest comment first), each link once
function ticketFiles(issue) {
  const all = [...issue.links, ...(issue.replies ?? []).flatMap((r) => filesFrom(r.links))]
  return all.filter((f, i) => all.findIndex((x) => x.url === f.url) === i)
}
// The ticket's comments as comments on the card (Khairul, 18 Nov 2026). One way: PMS -> TMS. Each has the id pms-<reply id>, so
// it is added once; comments written in the TMS stay in the TMS. Files in a comment are on the card as attachments already.
async function syncComments(db, Timestamp, FieldValue, taskId, replies) {
  if (!replies?.length) return 0
  const col = db.collection(`tasks/${taskId}/comments`)
  const have = new Set((await col.get()).docs.map((d) => d.id))
  const add = replies.filter((r) => !have.has(`pms-${r.id}`))
  if (!add.length) return 0
  for (let i = 0; i < add.length; i += 400) {
    const batch = db.batch()
    for (const r of add.slice(i, i + 400)) {
      const files = filesFrom(r.links).map((f) => f.name)
      const body = String(r.text ?? '').trim()
      const fileNote = files.length ? `${body ? '\n' : ''}(${files.length === 1 ? 'File' : 'Files'}: ${files.join(', ')}, see Attachments)` : ''
      const when = r.createdAt && !Number.isNaN(Date.parse(r.createdAt)) ? Timestamp.fromDate(new Date(r.createdAt)) : FieldValue.serverTimestamp()
      batch.set(col.doc(`pms-${r.id}`), {
        text: (body + fileNote).slice(0, 2000) || '(comment)', userId: typeof r.byUid === 'string' ? r.byUid : '',
        userName: `${text(typeof r.by === 'string' ? r.by : '', 80) || 'PMS user'} (PMS)`, createdAt: when, pmsReplyId: r.id,
      })
    }
    await batch.commit()
  }
  return add.length
}
// The card's attachments plus the ticket's files not on it yet (null when there is nothing to add)
function withFiles(atts, files, me) {
  const have = new Set(atts.map((a) => a.id))
  const add = files.filter((f) => !have.has(fileAttId(f.url))).slice(0, Math.max(0, 30 - atts.length))
  return add.length ? { list: [...atts, ...add.map((f) => fileAttachment(f, me))], added: add } : null
}
const sameList = (a, b) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|')

// A Firestore REST value in plain JS
export function plain(v) {
  if (!v || typeof v !== 'object') return null
  if ('stringValue' in v) return v.stringValue
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(plain)
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, plain(x)]))
  return null
}
// The parts of a PMS ticket the TMS uses
export function issueFrom(fields) {
  const o = plain({ mapValue: { fields } }) || {}
  const str = (v, max) => text(typeof v === 'string' ? v : '', max)
  return {
    title: str(o.title, 200), body: str(o.body, 5000), status: str(o.status, 20),
    // as typeOf() on the PMS Issues page: older tickets without a type are Customer when they have a unit
    type: o.type === 'customer' || o.type === 'inhouse' ? o.type : (o.unit ? 'customer' : 'inhouse'),
    tags: Array.isArray(o.tags) ? o.tags.filter((t) => typeof t === 'string') : [],
    property: str(o.property, 80), propertyId: str(o.propertyId, 100), unit: str(o.unit, 40),
    raisedBy: str(o.raisedBy, 80), raisedByUid: typeof o.raisedByUid === 'string' && UID.test(o.raisedByUid) ? o.raisedByUid : '', deleteReason: str(o.deleteReason, 300),
    // 18 Nov 2026: the people tagged on the ticket (PMS uids = TMS uids), at most 20
    // the files added when the ticket was raised (Google Drive links only)
    links: filesFrom(o.links),
    assigneeUids: [...new Set(Array.isArray(o.assigneeUids) ? o.assigneeUids.filter((u) => typeof u === 'string' && UID.test(u)) : [])].slice(0, 20),
  }
}

// The Maintenance workspace: MAINTENANCE_WORKSPACE_ID if set, otherwise the (not archived) workspace named "Maintenance"
async function maintenanceWorkspace(db) {
  const fixed = process.env.MAINTENANCE_WORKSPACE_ID
  if (fixed) {
    const s = await db.collection('workspaces').doc(fixed).get()
    if (s.exists) return { id: fixed, ...s.data() }
  }
  const snap = await db.collection('workspaces').where('name', '==', MAINTENANCE_WORKSPACE).get()
  const w = snap.docs.map((d) => ({ id: d.id, ...d.data() })).find((x) => !x.archived)
  if (!w) throw new HttpError(409, `There is no "${MAINTENANCE_WORKSPACE}" workspace in the task system`)
  return w
}

// Is this board the one for the ticket's property? (PMS property ID, else the board's name = the property's name)
const boardIsFor = (b, issue) => (!!issue.propertyId && b.pmsPropertyId === issue.propertyId) || sameBoardName(b.name, issue.property)

// The board of the ticket's property in the Maintenance workspace. Made when a PMS property has none (makeBoard).
// `hintId`: the TMS board a task was created on (a ticket raised from the TMS); it must be a board of the workspace.
async function boardFor(db, ws, id, issue, hintId) {
  const boards = (await db.collection('boards').where('workspaceId', '==', ws.id).get()).docs.map((d) => ({ id: d.id, ...d.data() }))
  if (hintId) {
    const b = boards.find((x) => x.id === hintId)
    if (!b) throw new HttpError(400, `That board is not in the ${MAINTENANCE_WORKSPACE} workspace`)
    return b
  }
  if (!issue.property) throw new HttpError(409, `${id} has no property. Choose its property in the PMS (Edit) so its card goes to that property's board`)
  const live = boards.filter((b) => !b.archived)
  const found = (issue.propertyId && live.find((b) => b.pmsPropertyId === issue.propertyId)) || live.find((b) => sameBoardName(b.name, issue.property))
  if (!found) {
    if (!issue.propertyId) throw new HttpError(409, `There is no board called "${issue.property}" in the ${MAINTENANCE_WORKSPACE} workspace. Make one with exactly that name`)
    return makeBoard(db, ws, issue)
  }
  // remember the PMS property ID, so the board is still found after either side renames it
  if (issue.propertyId && !found.pmsPropertyId) await db.collection('boards').doc(found.id).update({ pmsPropertyId: issue.propertyId })
  return found
}

// A new board for a PMS property that has none (12 Nov 2026). Its id is pms-{propertyId}, so two tickets raised at the same
// moment can't make two boards. Columns: TODO (Open), DOING (In progress), DONE (Completed), as Khairul asked.
// Board and columns are written together, so it never exists without columns.
const PMS_BOARD_COLUMNS = [{ name: 'TODO', color: 'sky' }, { name: 'DOING', color: 'honey' }, { name: 'DONE', color: 'sage', isDone: true }]
async function makeBoard(db, ws, issue) {
  const { FieldValue } = getServices()
  const ref = db.collection('boards').doc(`pms-${issue.propertyId}`)
  const old = await ref.get()
  if (old.exists) {
    // made before and archived: brought back
    if (old.data().archived) await ref.update({ archived: false, updatedAt: FieldValue.serverTimestamp() })
    return { id: ref.id, ...old.data(), archived: false }
  }
  const specs = PMS_BOARD_COLUMNS
  const now = FieldValue.serverTimestamp()
  const board = {
    workspaceId: ws.id, name: issue.property, description: 'Made by the PMS for this property\'s maintenance tickets',
    background: { type: 'color', color: 'sage' }, archived: false, members: {}, pmsPropertyId: issue.propertyId,
    createdBy: 'pms', createdAt: now, updatedAt: now,
  }
  const batch = db.batch()
  batch.create(ref, board)
  specs.forEach((c, i) => batch.set(db.collection('columns').doc(), {
    boardId: ref.id, name: c.name, position: (i + 1) * 1000, isDone: !!c.isDone, color: c.color ?? '', archived: false,
    limit: c.limit ?? null, createdAt: now,
  }))
  try { await batch.commit() } catch (e) {
    if (e?.code === 6 || e?.code === 'already-exists') { const s = await ref.get(); return { id: ref.id, ...s.data() } } // made a moment ago
    throw e
  }
  return { id: ref.id, ...board }
}

// action 'maintenanceBoards': the property boards of the Maintenance workspace, for the PMS "Raise a ticket" Property list.
// Any active PMS staff.                                                         -> { boards: [{ id, name, pmsPropertyId }] }
export async function maintenanceBoards() {
  const { db } = getServices()
  const ws = await maintenanceWorkspace(db)
  const snap = await db.collection('boards').where('workspaceId', '==', ws.id).get()
  const boards = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((b) => !b.archived)
    .map((b) => ({ id: b.id, name: b.name ?? '', pmsPropertyId: b.pmsPropertyId ?? null })).sort((a, b) => a.name.localeCompare(b.name))
  return { boards }
}

async function createFor(db, FieldValue, me, id, issue, hintId) {
  if (issue.type !== 'customer') return { ok: true, taskId: null, skipped: 'In-house tickets stay in the PMS' }
  if (!['open', 'progress'].includes(issue.status)) return { ok: true, taskId: null, skipped: 'The ticket is not open or in progress' }

  const ws = await maintenanceWorkspace(db)
  const board = await boardFor(db, ws, id, issue, hintId)
  const columns = await boardColumns(db, board.id)
  const column = columnForPmsStatus(issue.status, columns)
  if (!column) throw new HttpError(409, `The board "${board.name}" has no columns yet`)

  const now = FieldValue.serverTimestamp()
  const ref = db.collection('tasks').doc(issueTaskId(id))
  const title = issue.title || id
  const assignedTo = await assigneesFor(db, FieldValue, me, peopleOf(issue))
  // Maintenance department; without one, Procurement when tagged first, otherwise Operations
  const departmentId = (await maintenanceDepartment(db)) || issueDepartment(issue.tags)
  const batch = db.batch()
  batch.create(ref, { // create: refused if a sync at the same moment made it first
    projectId: DEFAULT_PROJECT_ID, boardId: board.id, workspaceId: ws.id,
    columnId: column.id, status: column.name.toUpperCase(), position: await endPosition(db, column.id),
    title, description: issue.body, category: '', departmentId, priority: 'medium',
    assignedTo, subtasks: [], labels: ['PMS', id, issue.unit].filter(Boolean),
    attachments: withFiles([], ticketFiles(issue), me)?.list ?? [],
    startDate: null, dueDate: null, estimatedHours: null, completedAt: column.isDone ? now : null,
    pmsLink: { type: ISSUE_LINK_TYPE, id }, pmsKey: issueKey(id), source: 'pms',
    createdBy: me.uid, createdByName: me.name, createdAt: now, updatedAt: now, activitySeq: 1,
  })
  addActivities(db, FieldValue, batch, ref.id, 0, me, [['created', `${title} (PMS ticket ${id}${issue.unit ? ` · ${issue.unit}` : ''})`]])
  try { await batch.commit() } catch (e) {
    if (e?.code === 6 || e?.code === 'already-exists') return syncIssue(me, { id }) // made a moment ago: bring it up to date instead
    throw e
  }
  return { ok: true, taskId: ref.id, created: true, boardId: board.id, boardName: board.name, columnId: column.id, column: column.name, status: pmsStatusOfColumn(column, columns) }
}

// A ticket deleted in the PMS: its task goes, with its activity records and its comments
async function deleteFor(db, id, snap) {
  const ref = snap.ref ?? db.collection('tasks').doc(snap.id)
  const acts = await db.collection('task_activities').where('taskId', '==', snap.id).get()
  for (let i = 0; i < acts.docs.length; i += 400) {
    const batch = db.batch()
    acts.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref ?? db.collection('task_activities').doc(d.id)))
    await batch.commit()
  }
  if (typeof db.recursiveDelete === 'function') await db.recursiveDelete(ref) // the task and its comments
  else await ref.delete()
  return { ok: true, taskId: null, deleted: true, deletedTaskId: snap.id, boardId: snap.data().boardId }
}

async function updateFor(db, FieldValue, me, id, issue, snap) {
  if (issue.status === 'deleted') return deleteFor(db, id, snap)
  if (issue.type !== 'customer') return { ...(await deleteFor(db, id, snap)), skipped: 'In-house tickets stay in the PMS' } // changed to In-house
  const t = snap.data()
  let columns = await boardColumns(db, t.boardId)
  let here = columns.find((c) => c.id === t.columnId) || null
  const now = FieldValue.serverTimestamp()
  const changes = {}
  const logs = []

  // the ticket's property changed in the PMS: the task moves to that property's board (stays put if it has none)
  let boardId = t.boardId
  if (issue.property) {
    const cur = await db.collection('boards').doc(t.boardId).get()
    if (!cur.exists || !boardIsFor({ id: t.boardId, ...cur.data() }, issue)) {
      const target = await maintenanceWorkspace(db).then((ws) => boardFor(db, ws, id, issue, '')).catch(() => null)
      if (target && target.id !== t.boardId) {
        boardId = target.id
        columns = await boardColumns(db, target.id)
        here = null // a column of the new board is chosen below
        Object.assign(changes, { boardId: target.id, workspaceId: target.workspaceId })
        logs.push(['moved', `to the board ${target.name} (${id}'s property in the PMS)`])
      }
    }
  }

  if (issue.title && issue.title !== t.title) { changes.title = issue.title; logs.push(['updated', `title synced from ${id} in the PMS`]) }
  if (issue.body !== (t.description ?? '')) { changes.description = issue.body; logs.push(['updated', `description synced from ${id} in the PMS`]) }

  const want = issue.status
  let to = here
  if (['open', 'progress', 'done'].includes(want) && (!here || pmsStatusOfColumn(here, columns) !== want)) {
    const target = columnForPmsStatus(want, columns)
    if (target && (target.id !== t.columnId || boardId !== t.boardId)) {
      to = target
      Object.assign(changes, { columnId: target.id, status: target.name.toUpperCase(), position: await endPosition(db, target.id) })
      logs.push(['moved', `to ${target.name} (${id} is ${{ open: 'Open', progress: 'In progress', done: 'Completed' }[want]} in the PMS)`])
    }
  }
  if (boardId !== t.boardId && !changes.columnId) { // the new board has no column for it: stay on the old board
    delete changes.boardId; delete changes.workspaceId
    logs.splice(logs.findIndex(([action]) => action === 'moved'), 1)
    boardId = t.boardId; columns = await boardColumns(db, t.boardId); to = columns.find((c) => c.id === t.columnId) || null
  }
  if (to?.isDone && !t.completedAt) changes.completedAt = now
  if (to && !to.isDone && t.completedAt) changes.completedAt = null

  if (!t.departmentId) changes.departmentId = (await maintenanceDepartment(db)) || issueDepartment(issue.tags)

  // 18 Nov 2026: Assigned to follows the ticket's raiser + People (assigneeUids)
  const assignedTo = await assigneesFor(db, FieldValue, me, peopleOf(issue))
  if (!sameList(assignedTo, t.assignedTo || [])) {
    changes.assignedTo = assignedTo
    logs.push(['updated', `Assigned to synced from ${id} in the PMS`])
  }

  // the ticket's files not on the card yet (from the ticket and its comments)
  const more = withFiles(t.attachments ?? [], ticketFiles(issue), me)
  if (more) {
    changes.attachments = more.list
    logs.push(['attached', `${more.added.length === 1 ? more.added[0].name : `${more.added.length} files`} from ${id} in the PMS`])
  }

  const reply = { ok: true, taskId: snap.id, boardId, columnId: to?.id ?? null, column: to?.name ?? null, status: pmsStatusOfColumn(to, columns) }
  if (!logs.length && !Object.keys(changes).length) return { ...reply, unchanged: true }
  const batch = db.batch()
  const activitySeq = logs.length ? addActivities(db, FieldValue, batch, snap.id, t.activitySeq, me, logs) : t.activitySeq
  batch.update(snap.ref ?? db.collection('tasks').doc(snap.id), { ...changes, ...(activitySeq ? { activitySeq } : {}), updatedAt: now },
    snap.updateTime ? { lastUpdateTime: snap.updateTime } : undefined)
  await commitOrConflict(batch)
  return reply
}

// data: { id: 'IS-0001', boardId? }  ->  { ok, taskId (null when the ticket does not go to the TMS), column, status, ... }
export async function syncIssue(me, data) {
  const { db, FieldValue, Timestamp } = getServices()
  const id = text(data.id, 20)
  if (!ISSUE_ID.test(id)) throw new HttpError(400, 'Send the ticket number, e.g. IS-0001')
  const fields = await readPmsDoc(`issues/${id}`, me.idToken)
  if (!fields) throw new HttpError(404, `No ticket ${id}, or you cannot see it in the PMS`)
  const issue = issueFrom(fields)
  if (issue.type === 'customer' && issue.status !== 'deleted') issue.replies = await pmsReplies(id, me)
  const snap = await db.collection('tasks').doc(issueTaskId(id)).get()
  const out = snap.exists ? await updateFor(db, FieldValue, me, id, issue, snap) : await createFor(db, FieldValue, me, id, issue, text(data.boardId, 100))
  // the ticket's comments follow onto the card (18 Nov 2026)
  if (out?.taskId && !out.deleted && issue.replies?.length) {
    const added = await syncComments(db, Timestamp, FieldValue, out.taskId, issue.replies)
    if (added) { out.commentsAdded = added; delete out.unchanged }
  }
  return out
}
