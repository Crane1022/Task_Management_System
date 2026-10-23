import { Timestamp } from '@/firebase/sdk'

const pad = (n) => String(n).padStart(2, '0')

// Firestore Timestamp <-> <input type="date"> value
export const toInput = (ts) => {
  const d = ts?.toDate?.()
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : ''
}
export const fromInput = (s) => (s ? Timestamp.fromDate(new Date(`${s}T00:00:00`)) : null)

export const formatDate = (ts) =>
  ts?.toDate?.().toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) ?? ''

// The person's chosen time zone (profile page). Only date-times such as the activity log use it; deadlines are plain dates.
let displayZone
export const setDisplayTimeZone = (tz) => {
  try { if (tz) new Intl.DateTimeFormat('en', { timeZone: tz }); displayZone = tz || undefined } catch { displayZone = undefined }
}

export const formatDateTime = (ts) =>
  ts?.toDate?.().toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: displayZone }) ?? 'just now'

export const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// 'overdue' | 'today' | 'later' | '' (no due date, or already completed)
export const dueState = (task) => {
  if (!task.dueDate || task.completedAt) return ''
  const due = task.dueDate.toDate()
  const today = startOfToday()
  if (due < today) return 'overdue'
  return due.getTime() === today.getTime() ? 'today' : 'later'
}
