import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import { useUiStore } from './ui'
import * as svc from '@/services/notificationService'
import { buildNotification, canSeeTask, taskAudience, unreadCount } from '@/utils/notifications'

// The bell: this person's notifications (live), and the functions the rest of the app calls when something happens.
export const useNotificationStore = defineStore('notifications', () => {
  const auth = useAuthStore()
  const ui = useUiStore()
  const items = ref([])
  const loading = ref(true)
  const failed = ref(false)
  let unsub = null
  let owner = ''
  let pruned = false

  const unread = computed(() => unreadCount(items.value))

  function start(uid) {
    if (!uid || uid === owner) return
    stop()
    owner = uid
    unsub = svc.subscribeNotifications(uid, (list) => {
      items.value = list; loading.value = false; failed.value = false
      const extra = svc.surplus(list)
      if (extra.length && !pruned) { pruned = true; svc.removeMany(uid, extra).catch(() => {}).finally(() => { pruned = false }) }
    }, () => { failed.value = true; loading.value = false })
  }
  function stop() { unsub?.(); unsub = null; owner = ''; items.value = []; loading.value = true; failed.value = false }

  const read = (n) => (n.read ? Promise.resolve() : svc.markRead(owner, n.id).catch(() => {}))
  const readAll = () => svc.markAllRead(owner, items.value.filter((n) => !n.read).map((n) => n.id)).catch(() => ui.toast('Could not mark them as read', 'error'))
  const clear = () => svc.removeMany(owner, items.value.map((n) => n.id)).catch(() => ui.toast('Could not clear the notifications', 'error'))
  const remove = (n) => svc.removeMany(owner, [n.id]).catch(() => {})

  // ----- sending: never blocks or breaks the action that caused it -----
  const me = () => auth.profile
  async function send(type, recipients, extra) {
    const by = me()
    const ids = [...new Set(recipients)].filter((id) => id && id !== by?.id)
    if (!by || !ids.length) return
    try { await svc.sendNotifications(ids.map((uid) => ({ uid, data: buildNotification(type, by, extra) }))) }
    catch (e) { console.warn('Notification not sent:', e.code ?? e.message) }
  }

  const taskAssigned = (task, uids) => send('assigned', uids, { task })
  // `users` = id -> user, `ws` = the task's workspace if known. Mentioned people get the mention instead of the plain comment notification.
  const commentPosted = (task, text, mentionIds, users, ws) => Promise.all([
    send('mention', mentionIds.filter((id) => canSeeTask(users[id] && { ...users[id], id }, task, ws)), { task, body: text }),
    send('comment', taskAudience(task, me()?.id, mentionIds).filter((id) => canSeeTask(users[id] && { ...users[id], id }, task, ws)), { task, body: text }),
  ])
  const taskMoved = (task, columnName, isDone) => send(isDone ? 'completed' : 'moved', taskAudience(task, me()?.id), { task, body: `${task.title} → ${columnName}` })
  const chatMention = (workspace, text, uids) => send('mention', uids, { workspace, body: text })
  const workspaceAdded = (workspace, uids) => send('workspace_added', uids, { workspace, body: workspace.name })
  const workspaceRemoved = (workspace, uids) => send('workspace_removed', uids, { workspace, body: workspace.name })

  return { items, loading, failed, unread, start, stop, read, readAll, clear, remove, taskAssigned, commentPosted, taskMoved, chatMention, workspaceAdded, workspaceRemoved }
})
