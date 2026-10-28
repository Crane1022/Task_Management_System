import { displayOf } from './constants.js'

// The kinds of notification shown in the bell. `deadline_soon` and `deadline_overdue` are made by the daily function
// (api/deadline-reminders.js); all the others are made by the app when the action happens.
export const NOTIFICATION_TYPES = [
  'assigned', 'comment', 'mention', 'moved', 'completed', 'workspace_added', 'workspace_removed', 'deadline_soon', 'deadline_overdue',
]
export const KEEP = 50 // at most this many are kept per person; older ones are removed

const clip = (s, n) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t }

// The document saved in users/{recipient}/notifications. Only these keys are allowed by firestore.rules.
export function buildNotification(type, by, { task = null, workspace = null, body = '' } = {}) {
  const who = displayOf(by)
  const title = {
    assigned: `${who} assigned you a task`,
    comment: `${who} commented on a task of yours`,
    mention: workspace ? `${who} mentioned you in the team chat` : `${who} mentioned you in a comment`,
    moved: `${who} moved a task`,
    completed: `${who} completed a task`,
    workspace_added: `${who} added you to a workspace`,
    workspace_removed: `${who} removed you from a workspace`,
  }[type] ?? who
  return {
    type,
    title: clip(title, 150),
    body: clip(body || task?.title || workspace?.name || '', 200),
    taskId: task?.id ?? '',
    boardId: task?.boardId ?? '',
    workspaceId: workspace?.id ?? task?.workspaceId ?? '',
    byId: by.id,
    byName: displayOf(by),
    read: false,
  }
}

// Can this person open the task? (the app's rule, used only to decide who is worth notifying; firestore.rules still decide for real)
// `ws` = the task's workspace document if known.
export function canSeeTask(user, task, ws) {
  if (!user) return false
  if (ws) return !!ws.members?.[user.id] || (user.role === 'super_admin' && ws.superPrivate !== true)
  if (task.workspaceId) return true // a workspace we can't see from here: don't guess
  return user.role === 'super_admin' || user.departmentId === task.departmentId || (task.assignedTo ?? []).includes(user.id)
}

// Who hears about something on a task: the assignees and the creator, never the person who did it, never twice.
export function taskAudience(task, actorId, skip = []) {
  return [...new Set([...(task.assignedTo ?? []), task.createdBy].filter((id) => id && id !== actorId && !skip.includes(id)))]
}

export const unreadCount = (items) => items.filter((n) => !n.read).length
export const newestFirst = (items) => [...items].sort((a, b) => (b.createdAt?.seconds ?? Infinity) - (a.createdAt?.seconds ?? Infinity))
