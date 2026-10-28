// A task keeps at most 15 activity records. Record number `seq` (1, 2, 3 ...) is saved as the document
// "<taskId>_<(seq - 1) % 15>" in `task_activities`, so a task can never have more than 15 of them and the 16th replaces
// the oldest. The task's own counter `activitySeq` is written in the same batch. This is the same protocol the web app
// uses (src/utils/activity.js) and that firestore.rules enforces for the browser; this server skips the rules, so it
// follows the protocol itself. (tests/activity-limit checks that both sides agree.)
export const ACTIVITY_LIMIT = 15
export const slotOf = (seq) => (seq - 1) % ACTIVITY_LIMIT
export const activityId = (taskId, seq) => `${taskId}_${slotOf(seq)}`

// Adds a record for each [action, detail] in `logs`, continuing after the task's counter `current`.
// Returns the task's new counter, which the caller must save on the task in the same batch.
export function addActivities(db, FieldValue, batch, taskId, current, me, logs) {
  let seq = Number.isInteger(current) && current > 0 ? current : 0
  for (const [action, detail] of logs) {
    seq += 1
    batch.set(db.collection('task_activities').doc(activityId(taskId, seq)), {
      taskId, seq, userId: me.uid, userName: me.name, action, detail, createdAt: FieldValue.serverTimestamp(),
    })
  }
  return seq
}
