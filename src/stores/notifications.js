import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import { useUiStore } from './ui'
import * as svc from '@/services/notificationService'
import { buildNotification, canSeeTask, taskAudience, unreadCount, linkFor, popTag, newForPopUp } from '@/utils/notifications'

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

  // A pop-up on the desktop made by the open app itself: works while the app window is open anywhere (behind other windows,
  // minimised, another tab), with no server. The server's push (api/send-push.js) covers the case where the app is closed.
  // Never shown while the app is in front (the bell is right there), or if the person switched pop-ups off on this computer.
  let seen = null // ids already known; null until the first snapshot (what was there before is not "new")
  async function showLocal(n) {
    try {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      if (localStorage.getItem('wb-popups') === 'off') return
      if (document.visibilityState === 'visible' && document.hasFocus()) return
      const reg = await navigator.serviceWorker?.getRegistration('/sw.js')
      if (!reg) return
      await reg.showNotification(n.title, { body: n.body || '', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: popTag(n), data: { url: linkFor(n) } })
    } catch { /* no pop-up is not an error */ }
  }

  function start(uid) {
    if (!uid || uid === owner) return
    stop()
    owner = uid
    unsub = svc.subscribeNotifications(uid, (list) => {
      const fresh = seen ? newForPopUp(list, seen) : []
      seen = new Set(list.map((n) => n.id))
      fresh.forEach(showLocal)
      items.value = list; loading.value = false; failed.value = false
      const extra = svc.surplus(list)
      if (extra.length && !pruned) { pruned = true; svc.removeMany(uid, extra).catch(() => {}).finally(() => { pruned = false }) }
    }, () => { failed.value = true; loading.value = false })
  }
  function stop() { unsub?.(); unsub = null; owner = ''; seen = null; items.value = []; loading.value = true; failed.value = false }

  const read = (n) => (n.read ? Promise.resolve() : svc.markRead(owner, n.id).catch(() => {}))
  const readAll = () => svc.markAllRead(owner, items.value.filter((n) => !n.read).map((n) => n.id)).catch(() => ui.toast('Could not mark them as read', 'error'))
  const clear = () => svc.removeMany(owner, items.value.map((n) => n.id)).catch(() => ui.toast('Could not clear the notifications', 'error'))
  const remove = (n) => svc.removeMany(owner, [n.id]).catch(() => {})

  // ----- sending: never blocks or breaks the action that caused it -----
  // Asks the server to show a desktop pop-up on the receivers' computers (if they turned it on). Best effort, silent on any problem.
  async function popUp(saved) {
    try {
      if (!saved?.length || !auth.user?.getIdToken) return
      await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.user.getIdToken()}` },
        body: JSON.stringify({ items: saved }),
      })
    } catch { /* the bell still has it */ }
  }
  const me = () => auth.profile
  async function send(type, recipients, extra) {
    const by = me()
    const ids = [...new Set(recipients)].filter((id) => id && id !== by?.id)
    if (!by || !ids.length) return
    try {
      const saved = await svc.sendNotifications(ids.map((uid) => ({ uid, data: buildNotification(type, by, extra) })))
      popUp(saved)
    } catch (e) { console.warn('Notification not sent:', e.code ?? e.message) }
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
