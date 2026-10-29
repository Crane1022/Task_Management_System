import { doc, setDoc, deleteDoc, getDoc, serverTimestamp, getMessaging, getToken, deleteToken, isMessagingSupported } from '@/firebase/sdk'
import { db, app } from '@/firebase/config'

// Desktop pop-ups for notifications (Web Push through Firebase Cloud Messaging, with the service worker public/sw.js).
// Each browser/computer that turns it on saves ONE small record at users/{uid}/devices/{id} holding its push address (token).
// Nothing here uses Firebase Storage, and no file is stored.
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

export const pushPossible = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export const pushPermission = () => (pushPossible() ? Notification.permission : 'unsupported') // 'default' | 'granted' | 'denied'

// the record id: a fingerprint of the token, so the same browser never makes two records
async function deviceId(token) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}
const registration = async () => {
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}
async function messaging() {
  if (!(await isMessagingSupported())) throw Object.assign(new Error('This browser cannot show desktop pop-ups.'), { code: 'push/unsupported' })
  return getMessaging(app)
}

// Is this browser already set up? (permission given and its token saved)
export async function pushIsOn(uid) {
  if (!pushPossible() || Notification.permission !== 'granted' || !VAPID_KEY) return false
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    if (!reg) return false
    const token = await getToken(await messaging(), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg })
    return token ? (await getDoc(doc(db, 'users', uid, 'devices', await deviceId(token)))).exists() : false
  } catch { return false }
}

// Asks the browser for permission (must come from a click), gets the push address and saves it
export async function enablePush(uid) {
  if (!pushPossible()) throw Object.assign(new Error('This browser cannot show desktop pop-ups.'), { code: 'push/unsupported' })
  if (!VAPID_KEY) throw Object.assign(new Error('Desktop pop-ups are not set up on the server yet (VITE_FIREBASE_VAPID_KEY is missing).'), { code: 'push/not-configured' })
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw Object.assign(new Error(permission === 'denied' ? 'Pop-ups are blocked for this site. Allow notifications in the browser’s site settings, then try again.' : 'Permission was not given.'), { code: 'push/denied' })
  const token = await getToken(await messaging(), { vapidKey: VAPID_KEY, serviceWorkerRegistration: await registration() })
  if (!token) throw Object.assign(new Error('The browser did not give a push address.'), { code: 'push/no-token' })
  await setDoc(doc(db, 'users', uid, 'devices', await deviceId(token)), {
    token, agent: navigator.userAgent.slice(0, 160), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

export async function disablePush(uid) {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  if (!reg) return
  const m = await messaging()
  const token = await getToken(m, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg }).catch(() => '')
  if (token) await deleteDoc(doc(db, 'users', uid, 'devices', await deviceId(token))).catch(() => {})
  await deleteToken(m).catch(() => {})
}
