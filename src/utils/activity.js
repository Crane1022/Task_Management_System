// Each task keeps at most 15 activity records. The limit is built into where a record can be written:
// a record's document ID is "<taskId>_<slot>" with slot 0..14, so a task can never have more than 15 of them.
// The newest record takes the slot of the oldest one (it is overwritten, i.e. permanently removed).
// `seq` counts a task's activities (1, 2, 3 ...); it lives on the task (`activitySeq`) and on each record, and
// firestore.rules only accepts a write when the task's counter moved up by exactly 1 in the same write.
export const ACTIVITY_LIMIT = 15

export const slotOf = (seq) => (seq - 1) % ACTIVITY_LIMIT
export const activityId = (taskId, seq) => `${taskId}_${slotOf(seq)}`
export const isSlotId = (id) => /^[^_]+_([0-9]|1[0-4])$/.test(String(id))

const when = (a) => a.createdAt?.seconds ?? Number.MAX_SAFE_INTEGER // a record not yet confirmed by the server is the newest
// Newest first, never more than the limit (also hides old records that were written before the limit existed)
export function newest(list, limit = ACTIVITY_LIMIT) {
  return [...list]
    .sort((a, b) => (when(b) - when(a)) || ((b.seq ?? 0) - (a.seq ?? 0)) || String(b.id).localeCompare(String(a.id)))
    .slice(0, limit)
}
// Records written before the limit existed (random IDs) that are beyond the newest 15
export const staleLegacy = (list, limit = ACTIVITY_LIMIT) => {
  const keep = new Set(newest(list, limit).map((a) => a.id))
  return list.filter((a) => !isSlotId(a.id) && !keep.has(a.id))
}
// Several changes saved together become one record
export const summarize = (notes) => notes.filter(Boolean).join('; ')
