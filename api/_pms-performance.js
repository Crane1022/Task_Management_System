// api/_pms-performance.js (TMS repo) — the 'performanceTasks' action for the PMS performance module.
// The leading underscore keeps Vercel from turning this file into its own route: it is only called from
// api/pms-task.js, AFTER that function has verified the PMS ID token and read the caller's PMS role (the same
// check every other PMS action already goes through).
//
// What it returns: every task assigned to ONE employee, with the workspace it sits in, so the PMS Director can
// pick the workspace(s) and tick which tasks count for the quarter. What it never returns:
//   - any task on a board inside a SUPER PRIVATE workspace (dropped here, on the server — it never leaves the TMS);
//   - task descriptions, comments, attachments or activity (title, dates and status only).
//
// Uses the Admin SDK (which skips firestore.rules), so the Super Private exclusion below is the only thing
// protecting those tasks. Keep it.

import { HttpError } from './_lib/pms.js'

const DONE_STATUSES = new Set(['done', 'completed', 'complete']);
const CANCELLED_STATUSES = new Set(['cancelled', 'canceled']);

// Firestore Timestamp, Date, ISO string or millis -> ISO string (or null). Sent as a full instant, not a day, so
// the PMS can show it in the viewer's own time zone (a "Nov 4" due date stored as local midnight in Malaysia is
// Nov 3 16:00 UTC — cutting the UTC string to a date would show the wrong day).
function iso(v) {
  if (!v) return null;
  try {
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d) ? null : d.toISOString();
  } catch (_) { return null; }
}

// Same error type as every other action in api/pms-task.js, so handle() sends the right status and message.
function fail(status, message) { throw new HttpError(status, message); }

// db: the TMS Admin Firestore instance (getServices().db). caller: `me` from pmsUser(req) in api/pms-task.js
// — the verified PMS user, with their PMS role. data: { employeeUid }.
// A task counts as completed when it has completedAt: the board sets that when a card goes into a done column
// (and update() in pms-task.js does the same), so it's the reliable signal whatever the column is called.
export async function performanceTasks(db, caller, data = {}) {
  if (caller?.role !== 'director') fail(403, 'Only Directors can read tasks for performance scoring.');
  const employeeUid = typeof data.employeeUid === 'string' ? data.employeeUid.trim() : '';
  if (!employeeUid || employeeUid.length > 128) fail(400, 'employeeUid is required.');

  // PMS uids are TMS uids, so this is a direct match on the task's assignee list. array-contains needs no index.
  const snap = await db.collection('tasks').where('assignedTo', 'array-contains', employeeUid).get();
  const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (!tasks.length) return { ok: true, tasks: [] };

  // A task with no board document is on the original board ("main" etc.) — not in any workspace.
  // A task whose board HAS a document belongs to that board's workspace.
  const boardIds = [...new Set(tasks.map(t => t.boardId).filter(Boolean))];
  const boardSnaps = boardIds.length ? await db.getAll(...boardIds.map(id => db.collection('boards').doc(id))) : [];
  const boards = new Map(boardSnaps.filter(s => s.exists).map(s => [s.id, s.data()]));

  const workspaceIds = [...new Set([...boards.values()].map(b => b.workspaceId).filter(Boolean))];
  const wsSnaps = workspaceIds.length ? await db.getAll(...workspaceIds.map(id => db.collection('workspaces').doc(id))) : [];
  const workspaces = new Map(wsSnaps.filter(s => s.exists).map(s => [s.id, s.data()]));

  const out = [];
  for (const t of tasks) {
    const board = boards.get(t.boardId);
    let workspaceId = 'main', workspaceName = 'Main board', boardName = 'Main board';
    if (board) {
      const ws = workspaces.get(board.workspaceId);
      if (!ws) continue;                       // workspace missing: can't tell if it was private, so leave it out
      if (ws.superPrivate === true) continue;  // Super Private: never shared with the PMS
      workspaceId = board.workspaceId;
      workspaceName = String(ws.name || 'Workspace').slice(0, 80);
      boardName = String(board.name || 'Board').slice(0, 80);
    }
    const status = String(t.status || '');
    const s = status.toLowerCase();
    out.push({
      id: t.id,
      title: String(t.title || 'Untitled task').slice(0, 200),
      status,
      completed: !!t.completedAt || DONE_STATUSES.has(s),
      completedAt: iso(t.completedAt),
      cancelled: t.cancelled === true || CANCELLED_STATUSES.has(s),
      dueDate: iso(t.dueDate),
      createdAt: iso(t.createdAt),
      workspaceId, workspaceName,
      boardId: t.boardId || 'main', boardName
    });
  }
  return { ok: true, tasks: out };
}