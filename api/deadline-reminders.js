// GET /api/deadline-reminders   Authorization: Bearer <CRON_SECRET>
// Run once a day by Vercel Cron (vercel.json). Writes "due soon" and "overdue" notifications into the assignees' bells.
// Safe to run again: each notification has a fixed id, so nobody is told twice about the same task.
import { timingSafeEqual } from 'node:crypto'
import { getServices, HttpError } from './_lib/pms.js'
import { planReminders, startOfDay, DAY } from './_lib/deadlines.js'

const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

async function run(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) throw new HttpError(500, 'CRON_SECRET is not set')
  const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!given || !same(given, secret)) throw new HttpError(401, 'Not allowed')

  const { db, Timestamp } = getServices()
  const offset = Number(process.env.REMINDER_UTC_OFFSET_HOURS ?? 8)
  const now = new Date()
  const limit = new Date(startOfDay(now, offset).getTime() + 2 * DAY) // everything before the day after tomorrow
  // one range filter on one field: needs no composite index
  const snap = await db.collection('tasks').where('dueDate', '<', Timestamp.fromDate(limit)).get()
  const tasks = snap.docs.map((d) => {
    const x = d.data()
    return { id: d.id, title: x.title, boardId: x.boardId, workspaceId: x.workspaceId, dueDate: x.dueDate?.toDate?.(), completedAt: x.completedAt, assignedTo: x.assignedTo }
  })
  const plan = planReminders(tasks, now, offset)

  let created = 0
  for (const p of plan) {
    try {
      await db.collection('users').doc(p.uid).collection('notifications').doc(p.id).create({ ...p.data, createdAt: getServices().FieldValue.serverTimestamp() })
      created++
    } catch (e) {
      if (e.code !== 6 && !/already exists/i.test(e.message ?? '')) throw e // 6 = ALREADY_EXISTS: told before, fine
    }
  }
  return { ok: true, checked: tasks.length, created }
}

// Not wrapped in handle(): Vercel Cron calls with GET and no browser Origin, and only the secret lets a caller in.
export default async function handler(req, res) {
  try {
    res.status(200).json(await run(req))
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message })
    console.error(e)
    res.status(500).json({ error: 'Reminder error' })
  }
}
