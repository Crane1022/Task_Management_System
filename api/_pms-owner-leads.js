// actions 'ownerLeads', 'moveOwnerLead' and 'commentOwnerLead' of /api/pms-task: the PMS Procurement > Owner Leads pages read and move the
// cards of the TMS board "Owner Leads" in the workspace "Business Development & Procurement". See docs/PMS_LINK.md,
// "Owner Leads".
//
// The board's columns are the lead statuses, both ways:
//   New -> 'new'   In Progress -> 'progress'   Signed -> 'signed'   Live -> 'live'   Cancelled -> 'cancelled'
// Columns are matched by name (spaces and capitals ignored). A card in any other column has status null.
// A card with no pmsLink is a lead nobody has started in the PMS yet; Start listing links it to NL-000n
// (pmsLink { type: 'newOwnerListing', id: 'NL-000n' }) through the existing 'link' action.
// The workspace and board are found by name; a Super Private workspace (superPrivate: true) is never used.
import { addActivities } from './_lib/activity.js'
import { getServices, text, HttpError, pmsDocGone } from './_lib/pms.js'
import { boardColumns, endPosition, commitOrConflict } from './_lib/board.js'

import {
  OWNER_LEADS_WORKSPACE, OWNER_LEADS_BOARD, OWNER_LEAD_LINK_TYPE, LEAD_STATUSES, leadStatusOfColumn,
  isOwnerLeadsWorkspace, isOwnerLeadsBoardDoc,
} from './_lib/ownerLeadStatus.js'

export { OWNER_LEAD_LINK_TYPE, leadStatusOfColumn }
// PMS roles that may read the leads, and move them
export const LEADS_READ_ROLES = ['director', 'procurement', 'marketing', 'operations']
export const LEADS_MOVE_ROLES = ['director', 'procurement']
const iso = (ts) => ts?.toDate?.().toISOString() ?? null

// The Owner Leads board: { id, name, workspaceId }. 409 with the reason when it can't be found.
export async function ownerLeadsBoard(db) {
  const wsSnap = await db.collection('workspaces').get()
  const ws = wsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .find(isOwnerLeadsWorkspace)
  if (!ws) throw new HttpError(409, `There is no "${OWNER_LEADS_WORKSPACE}" workspace in the task system`)
  const bSnap = await db.collection('boards').where('workspaceId', '==', ws.id).get()
  const board = bSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .find(isOwnerLeadsBoardDoc)
  if (!board) throw new HttpError(409, `There is no "${OWNER_LEADS_BOARD}" board in the ${OWNER_LEADS_WORKSPACE} workspace`)
  return { id: board.id, name: board.name, workspaceId: ws.id }
}

// Is this task a card of the Owner Leads board? (used by 'link' so Procurement can link a card of any department)
export async function isOwnerLeadCard(db, t) {
  if (!t?.boardId) return false
  try { return (await ownerLeadsBoard(db)).id === t.boardId } catch { return false }
}

// action 'ownerLeads'. Director, Procurement, Marketing, Operations.        -> { ok, boardId, leads: [...] }
export async function ownerLeads(me) {
  if (!LEADS_READ_ROLES.includes(me.role)) throw new HttpError(403, 'Owner Leads are not open to your role')
  const { db } = getServices()
  const board = await ownerLeadsBoard(db)
  const columns = await boardColumns(db, board.id)
  const byId = new Map(columns.map((c) => [c.id, c]))
  const snap = await db.collection('tasks').where('boardId', '==', board.id).get()
  const leads = snap.docs.map((d) => ({ id: d.id, t: d.data() }))
    .filter(({ t }) => !t.archived)
    .map(({ id, t }) => {
      const col = byId.get(t.columnId) || null
      return {
        taskId: id, title: t.title || '', description: t.description || '',
        createdAt: iso(t.createdAt), updatedAt: iso(t.updatedAt), dueDate: iso(t.dueDate),
        column: col?.name ?? '', status: leadStatusOfColumn(col),
        assigneeUids: t.assignedTo || [], createdByName: t.createdByName || '',
        pmsLink: t.pmsLink || null,
      }
    })
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
  return { ok: true, boardId: board.id, leads }
}

// action 'moveOwnerLead'. Director or Procurement. taskId, data: { status } -> the card goes to the end of that
// status's column, in any direction.                                          -> { ok, taskId, column, status, moved }
export async function moveOwnerLead(me, taskId, data) {
  if (!LEADS_MOVE_ROLES.includes(me.role)) throw new HttpError(403, 'Only Directors and Procurement move Owner Leads')
  if (!taskId || typeof taskId !== 'string' || taskId.includes('/')) throw new HttpError(400, 'taskId is missing')
  const want = text(data.status, 20)
  if (!LEAD_STATUSES.includes(want)) throw new HttpError(400, `status must be one of ${LEAD_STATUSES.join(', ')}`)
  const { db, FieldValue } = getServices()
  const board = await ownerLeadsBoard(db)
  const ref = db.collection('tasks').doc(taskId)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpError(404, 'No such task')
  const t = snap.data()
  if (t.boardId !== board.id) throw new HttpError(400, `This task is not on the ${OWNER_LEADS_BOARD} board`)
  const columns = (await boardColumns(db, board.id)).filter((c) => !c.archived)
  const target = columns.find((c) => leadStatusOfColumn(c) === want)
  if (!target) throw new HttpError(409, `The ${OWNER_LEADS_BOARD} board has no column for "${want}"`)
  if (target.id === t.columnId) return { ok: true, taskId, column: target.name, status: want, moved: false }

  const from = columns.find((c) => c.id === t.columnId)?.name || 'another column'
  const now = FieldValue.serverTimestamp()
  const changes = { columnId: target.id, status: target.name.toUpperCase(), position: await endPosition(db, target.id), updatedAt: now }
  if (target.isDone && !t.completedAt) changes.completedAt = now
  if (!target.isDone && t.completedAt) changes.completedAt = null
  const batch = db.batch()
  changes.activitySeq = addActivities(db, FieldValue, batch, taskId, t.activitySeq, me,
    [['moved', `from ${from} to ${target.name}. Moved from the PMS by ${me.name}`]])
  batch.update(ref, changes, snap.updateTime ? { lastUpdateTime: snap.updateTime } : undefined)
  await commitOrConflict(batch)
  return { ok: true, taskId, column: target.name, status: want, moved: true }
}

// action 'commentOwnerLead'. Director, Procurement, Marketing, Operations. taskId, data: { text } -> a comment on an
// Owner Leads card (tasks/{id}/comments, shown under Comments with the caller's name), plus an activity line. The PMS
// sends a listing's Remarks this way when they are first filled in or changed.          -> { ok, taskId, commentId }
export async function commentOwnerLead(me, taskId, data) {
  if (!LEADS_READ_ROLES.includes(me.role)) throw new HttpError(403, 'Owner Leads are not open to your role')
  if (!taskId || typeof taskId !== 'string' || taskId.includes('/')) throw new HttpError(400, 'taskId is missing')
  const body = text(data.text, 2000)
  if (!body) throw new HttpError(400, 'text is missing')
  const { db, FieldValue } = getServices()
  const board = await ownerLeadsBoard(db)
  const ref = db.collection('tasks').doc(taskId)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpError(404, 'No such task')
  const t = snap.data()
  if (t.boardId !== board.id) throw new HttpError(400, `This task is not on the ${OWNER_LEADS_BOARD} board`)
  const now = FieldValue.serverTimestamp()
  const cRef = db.collection(`tasks/${taskId}/comments`).doc()
  const batch = db.batch()
  batch.set(cRef, { text: body, userId: me.uid, userName: me.name, createdAt: now, fromPms: true })
  const activitySeq = addActivities(db, FieldValue, batch, taskId, t.activitySeq, me, [['commented', 'remarks from the PMS']])
  batch.update(ref, { activitySeq, updatedAt: now }, snap.updateTime ? { lastUpdateTime: snap.updateTime } : undefined)
  await commitOrConflict(batch)
  return { ok: true, taskId, commentId: cRef.id }
}

// action 'deleteOwnerLead' (13 Nov 2026). PMS Directors only. taskId. Deletes an Owner Leads card for good, with its
// activity records and comments, once its listing is gone from the PMS (the PMS Delete listing deletes the listing
// first, then calls this). A card whose listing still exists is refused: it is moved to Cancelled instead.
//                                                                              -> { ok, taskId, deleted: true }
export async function deleteOwnerLead(me, taskId) {
  if (me.role !== 'director') throw new HttpError(403, 'Only Directors delete Owner Leads cards')
  if (!taskId || typeof taskId !== 'string' || taskId.includes('/')) throw new HttpError(400, 'taskId is missing')
  const { db } = getServices()
  const board = await ownerLeadsBoard(db)
  const ref = db.collection('tasks').doc(taskId)
  const snap = await ref.get()
  if (!snap.exists) return { ok: true, taskId, deleted: false }
  const t = snap.data()
  if (t.boardId !== board.id) throw new HttpError(400, `This task is not on the ${OWNER_LEADS_BOARD} board`)
  const link = t.pmsLink
  if (link?.type !== OWNER_LEAD_LINK_TYPE || !/^NL-[0-9]{4,}$/.test(link.id || '')) throw new HttpError(400, 'This card is not linked to a PMS listing')
  if (!(await pmsDocGone(`newOwnerListings/${link.id}`, me.idToken))) throw new HttpError(409, `${link.id} still exists in the PMS: delete the listing there first`)
  const acts = await db.collection('task_activities').where('taskId', '==', taskId).get()
  for (let i = 0; i < acts.docs.length; i += 400) {
    const batch = db.batch()
    acts.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
  if (typeof db.recursiveDelete === 'function') await db.recursiveDelete(ref) // the card and its comments
  else await ref.delete()
  return { ok: true, taskId, deleted: true }
}
