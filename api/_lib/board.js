// Board helpers for the /api functions (files starting with "_" are not deployed as functions).
import { HttpError } from './pms.js'

export const MAIN_BOARD = 'main' // src/utils/constants.js BOARD_ID
export const STEP = 1000 // gap between card positions, as on the board

// Columns of ONE board in order (archived ones included; callers skip them where needed)
export async function boardColumns(db, boardId = MAIN_BOARD) {
  const snap = await db.collection('columns').where('boardId', '==', boardId).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
}

// The position after the last card of a column
export async function endPosition(db, columnId) {
  const snap = await db.collection('tasks').where('columnId', '==', columnId).get()
  return snap.docs.reduce((m, d) => Math.max(m, d.data().position ?? 0), 0) + STEP
}

// A batch that fails because the task changed since it was read means two people saved at the same moment: ask to try again
export async function commitOrConflict(batch) {
  try { await batch.commit() } catch (e) {
    if (e?.code === 9 || e?.code === 'failed-precondition') throw new HttpError(409, 'The task was changed at the same moment. Please try again.')
    throw e
  }
}
