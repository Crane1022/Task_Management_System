// Pictures for the companion (the uploaded character, and the face photo) live ONLY on this device, in the browser's
// IndexedDB. They are not sent anywhere and they are not put in Firestore (no base64 in documents, and Firebase
// Storage is not available on this project). The settings (colours, size, flags) do sync; the pictures do not.
// Keys start with the person's uid, so two people using the same browser never see each other's pictures.
export const imageKey = (uid, kind) => `${uid}:${kind}` // kind: 'custom' | 'face'

// `kv` is any { get, put, del } with promises. The default one uses IndexedDB; tests use a Map.
export function createImageStore(kv) {
  return {
    get: (uid, kind) => kv.get(imageKey(uid, kind)),
    put: (uid, kind, blob) => kv.put(imageKey(uid, kind), blob),
    del: (uid, kind) => kv.del(imageKey(uid, kind)),
    async clear(uid) { await Promise.all(['custom', 'face'].map((k) => kv.del(imageKey(uid, k)))) },
  }
}

export function memoryKv() {
  const m = new Map()
  return { async get(k) { return m.get(k) ?? null }, async put(k, v) { m.set(k, v) }, async del(k) { m.delete(k) } }
}

// IndexedDB, falling back to memory (a private window can block it: pictures then last until the tab closes)
export function indexedDbKv(name = 'widebed-companion') {
  const fallback = memoryKv()
  let dbPromise
  const open = () => dbPromise ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexedDB'))
    const req = indexedDB.open(name, 1)
    req.onupgradeneeded = () => req.result.createObjectStore('images')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  const run = async (mode, fn) => {
    const db = await open()
    return new Promise((resolve, reject) => {
      const store = db.transaction('images', mode).objectStore('images')
      const req = fn(store)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  }
  const safe = (idb, mem) => async (...a) => { try { return await idb(...a) } catch { return mem(...a) } }
  return {
    get: safe((k) => run('readonly', (s) => s.get(k)), fallback.get),
    put: safe((k, v) => run('readwrite', (s) => s.put(v, k)), fallback.put),
    del: safe((k) => run('readwrite', (s) => s.delete(k)), fallback.del),
  }
}
