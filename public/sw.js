// Widebed Tasks service worker. Its ONLY job is desktop pop-ups (Web Push through Firebase Cloud Messaging).
// It caches nothing, so it can never serve an old copy of the app.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

// The server sends { data: { title, body, url, tag } } (FCM wraps it as { data: {...} }).
function readPayload(event) {
  try {
    const p = event.data ? event.data.json() : {}
    const d = p.data || p.notification || p
    return { title: d.title, body: d.body, url: d.url, tag: d.tag }
  } catch { return {} }
}

self.addEventListener('push', (event) => {
  const { title, body, url, tag } = readPayload(event)
  event.waitUntil((async () => {
    // If the app is open and in front, the bell already shows it: no pop-up on top of it
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (wins.some((c) => c.visibilityState === 'visible' && c.focused)) return
    await self.registration.showNotification(title || 'Widebed Tasks', {
      body: body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: tag || undefined, // the same task/chat replaces its older pop-up instead of piling up
      renotify: !!tag,
      data: { url: url || '/' },
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = event.notification.data?.url || '/'
  const target = new URL(path, self.location.origin)
  if (target.origin !== self.location.origin) return // only ever open our own pages
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = wins.find((c) => new URL(c.url).origin === target.origin)
    if (open) { await open.focus(); if ('navigate' in open) await open.navigate(target.href).catch(() => {}); return }
    await self.clients.openWindow(target.href)
  })())
})
