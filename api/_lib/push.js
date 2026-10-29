// Desktop pop-ups: turns a notification into a Web Push message (Firebase Cloud Messaging) for every device the person turned on.
// Files starting with "_" are not deployed as functions.

// Where clicking the pop-up goes (the same places the bell goes)
export function linkFor(n) {
  if (n.taskId) return `/b/${encodeURIComponent(n.boardId || 'main')}?task=${encodeURIComponent(n.taskId)}`
  if (n.type === 'mention' && n.workspaceId) return `/workspaces/${encodeURIComponent(n.workspaceId)}/chat`
  if (n.workspaceId && n.type !== 'workspace_removed') return `/workspaces/${encodeURIComponent(n.workspaceId)}`
  return '/'
}

const DEAD = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument'])

// Sends one notification (the stored document `n`) to all of `uid`'s devices. Returns how many devices accepted it.
// Never throws for a delivery problem: a failed pop-up must not break anything else.
// `info.errors` (optional) collects what Firebase said when it refused, so a test can show the reason.
export async function pushToUser({ db, messaging }, uid, n, info = {}) {
  info.errors ??= []
  let docs
  try { docs = (await db.collection('users').doc(uid).collection('devices').get()).docs.filter((d) => typeof d.data().token === 'string') }
  catch (e) { console.warn('push: could not read devices:', e.message); return 0 }
  if (!docs.length) return 0
  const message = {
    tokens: docs.map((d) => d.data().token),
    // data-only: the service worker (public/sw.js) builds the pop-up
    data: {
      title: String(n.title ?? 'Widebed Tasks').slice(0, 150),
      body: String(n.body ?? '').slice(0, 200),
      url: linkFor(n),
      ...(n.test ? { test: '1' } : {}),
      tag: n.taskId ? `task-${n.taskId}` : n.workspaceId ? `ws-${n.workspaceId}` : String(n.type ?? 'n'),
    },
    webpush: { headers: { Urgency: 'high', TTL: '86400' } },
  }
  let res
  try { res = await messaging.sendEachForTokens(message) } catch (e) { console.warn('push failed:', e.code ?? e.message); info.errors.push(`${e.code ?? 'error'}: ${String(e.message ?? '').slice(0, 160)}`); return 0 }
  let ok = 0
  await Promise.all(res.responses.map(async (r, i) => {
    if (r.success) { ok++; return }
    info.errors.push(`${r.error?.code ?? 'error'}: ${String(r.error?.message ?? '').slice(0, 160)}`)
    if (DEAD.has(r.error?.code)) await docs[i].ref.delete().catch(() => {}) // the browser was uninstalled/reset: forget it
  }))
  return ok
}
