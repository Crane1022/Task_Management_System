// One-off migration for the Super Private and 15-activity-record update. Run it ONCE, BEFORE publishing the new firestore.rules.
//
//   node scripts/migrate-workspaces-and-activity.mjs            (a dry run: shows what it would do, changes nothing)
//   node scripts/migrate-workspaces-and-activity.mjs --apply    (does it)
//
// It needs a service account for the TMS Firebase project. Point to it with the same variable the API uses:
//   TMS_SERVICE_ACCOUNT_FILE=C:\path\to\service-account.json     (or GOOGLE_APPLICATION_CREDENTIALS)
// The key stays on your computer; this script never prints it and nothing in the repository contains it.
//
// What it does
//   1. Every existing workspace gets  superPrivate: false  (so nothing becomes private by surprise, and Directors can still list them).
//   2. Every task's activity is cut down to its latest 15 records. The 15 newest are rewritten as numbered records
//      "<taskId>_<slot>" (oldest first), the task gets activitySeq = number kept, and every older or unnumbered record is deleted.
//   3. Activity belonging to tasks that no longer exist is deleted.
// It is safe to run twice (the second run finds nothing to do).
import { readFileSync } from 'node:fs'
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { activityId, ACTIVITY_LIMIT } from '../api/_lib/activity.js'

const APPLY = process.argv.includes('--apply')
const file = process.env.TMS_SERVICE_ACCOUNT_FILE
initializeApp({ credential: file ? cert(JSON.parse(readFileSync(file, 'utf8'))) : applicationDefault() })
const db = getFirestore()
console.log(APPLY ? 'APPLY mode: changes will be written.\n' : 'DRY RUN: nothing is changed. Add --apply to do it.\n')

const stats = { workspaces: 0, tasks: 0, kept: 0, deleted: 0, orphans: 0 }
let batch = db.batch()
let ops = 0
async function flush(force = false) {
  if (ops && (force || ops >= 400)) { if (APPLY) await batch.commit(); batch = db.batch(); ops = 0 }
}
const queue = async (fn) => { fn(batch); ops++; await flush() }

// 1. workspaces
for (const w of (await db.collection('workspaces').get()).docs) {
  if (typeof w.data().superPrivate === 'boolean') continue
  stats.workspaces++
  await queue((b) => b.update(w.ref, { superPrivate: false }))
}

// 2 + 3. activity
const byTask = new Map()
for (const a of (await db.collection('task_activities').get()).docs) {
  const taskId = a.data().taskId
  if (!byTask.has(taskId)) byTask.set(taskId, [])
  byTask.get(taskId).push(a)
}
const secs = (d) => d.data().createdAt?.seconds ?? d.data().createdAt?._seconds ?? 0
for (const [taskId, docs] of byTask) {
  const task = await db.collection('tasks').doc(String(taskId)).get()
  if (!task.exists) { stats.orphans += docs.length; for (const d of docs) await queue((b) => b.delete(d.ref)); continue }
  const newest = [...docs].sort((a, b) => secs(b) - secs(a) || (b.data().seq ?? 0) - (a.data().seq ?? 0) || b.id.localeCompare(a.id)).slice(0, ACTIVITY_LIMIT).reverse() // oldest first
  const alreadyOk = docs.length <= ACTIVITY_LIMIT && newest.every((d, i) => d.id === activityId(taskId, i + 1)) && task.data().activitySeq === newest.length
  if (alreadyOk) continue
  stats.tasks++
  // rewrite the newest records under their numbered IDs, and delete every other record of this task
  const keepIds = new Set(newest.map((_, i) => activityId(taskId, i + 1)))
  const rewrites = newest.map((d, i) => ({ id: activityId(taskId, i + 1), data: { ...d.data(), taskId, seq: i + 1 } }))
  for (const d of docs) if (!keepIds.has(d.id)) { stats.deleted++; await queue((b) => b.delete(d.ref)) }
  for (const r of rewrites) { stats.kept++; await queue((b) => b.set(db.collection('task_activities').doc(r.id), r.data)) }
  await queue((b) => b.update(task.ref, { activitySeq: newest.length }))
}
await flush(true)

console.log(`Workspaces given superPrivate:false : ${stats.workspaces}`)
console.log(`Tasks whose history was tidied      : ${stats.tasks}`)
console.log(`  records kept (newest 15 per task) : ${stats.kept}`)
console.log(`  older records deleted             : ${stats.deleted}`)
console.log(`Records of deleted tasks removed    : ${stats.orphans}`)
console.log(APPLY ? '\nDone.' : '\nDry run only. Run again with --apply to make these changes.')
