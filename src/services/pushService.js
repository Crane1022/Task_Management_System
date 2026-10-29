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

// What a Firebase refusal usually means, in plain words
export function hintFor(errors) {
  const t = errors.join(' ').toLowerCase()
  if (/mismatched-credential|sender id/.test(t)) return 'The service account in Vercel (TMS_SERVICE_ACCOUNT) is from a different Firebase project than the one this app uses. Use the key of the same project.'
  if (/has not been used|is disabled|api.*not.*enabled|accessnotconfigured|service_disabled/.test(t)) return 'Turn on the "Firebase Cloud Messaging API" for this project in Google Cloud Console (APIs & Services > Library).'
  if (/permission|403|insufficient|unauthorized|third-party-auth/.test(t)) return 'The service account is not allowed to send messages. In Google Cloud > IAM give it the role "Firebase Cloud Messaging API Admin" (or use the default firebase-adminsdk key).'
  if (/registration-token|not-registered|invalid-argument/.test(t)) return 'This browser\'s saved push address is no longer valid. Switch Desktop pop-ups off, then on again.'
  return ''
}

// ----- "Send test pop-up": checks each link of the chain and says in plain words where it breaks -----
// returns [{ ok, text }]. `getIdToken` gives the signed-in person's token for the server call.
export async function runPushTest(uid, getIdToken) {
  const out = []
  const add = (ok, text) => { out.push({ ok, text }); return ok }
  if (!pushPossible()) return [{ ok: false, text: 'This browser cannot show desktop pop-ups.' }]
  if (!add(!!VAPID_KEY, VAPID_KEY ? 'The app has its push key.' : 'The app was built without VITE_FIREBASE_VAPID_KEY. Add it in Vercel and redeploy.')) return out
  if (!add(Notification.permission === 'granted', Notification.permission === 'granted' ? 'The browser allows notifications for this site.' : 'Notifications are not allowed for this site yet. Switch Desktop pop-ups on and press Allow.')) return out
  let reg
  try { reg = await registration(); add(!!reg.active, reg.active ? 'The pop-up helper (sw.js) is running.' : 'The pop-up helper (sw.js) is not active yet. Reload the page once.') } catch (e) { add(false, `The pop-up helper could not start: ${e.message}`); return out }
  // 1. straight from this page: if this shows nothing, it is Windows/browser settings (Focus Assist, notifications blocked for the browser)
  try { await reg.showNotification('Test 1 of 2: from this computer', { body: 'If you can see this pop-up, Windows and the browser are fine.', icon: '/icons/icon-192.png', tag: `wb-test-${Date.now()}` }); add(true, 'Test 1 sent. Look at the corner of your screen. If nothing appears, check Windows Settings > System > Notifications (allow Chrome/Edge) and turn off Focus Assist / Do Not Disturb.') }
  catch (e) { add(false, `The browser refused to show a pop-up: ${e.message}`); return out }
  // 2. through the server and Firebase: the same road a real notification takes
  try {
    const r = await fetch('/api/send-push', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getIdToken()}` }, body: JSON.stringify({ test: true }) })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) add(false, r.status === 404 ? 'The server function /api/send-push was not found. Deploy the api folder (and check the site and api are on the same address).' : `The server answered ${r.status}${body.error ? `: ${body.error}` : ''}.`)
    else if (!body.devices) add(false, 'The server has no saved device for you. Switch Desktop pop-ups off and on again (and check firestore.rules is published).')
    else if (!body.sent) add(false, `The server tried but Firebase did not accept it. Firebase said: ${(body.errors ?? []).join(' | ') || '(no reason given: see the Vercel function logs)'}. ${hintFor(body.errors ?? [])}`)
    else add(true, `Test 2 sent through the server to ${body.sent} device(s). A second pop-up should appear within a few seconds.`)
  } catch (e) { add(false, `Could not reach the server: ${e.message}`) }
  return out
}
