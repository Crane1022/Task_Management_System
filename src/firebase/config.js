import { initializeApp } from '@/firebase/sdk'
import { getAuth } from '@/firebase/sdk'
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from '@/firebase/sdk'

// All values come from environment variables (see .env.example). Nothing is hardcoded.
export const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

export const auth = getAuth(app)
// Offline mode (26 Nov 2026): tasks already seen are kept on this device (in every open tab), so the app opens with
// weak or no signal; changes made offline are sent as soon as the connection is back. A browser that cannot keep the
// copy (private browsing, very old browsers) simply works online only, as before.
function openDb() {
  try { return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }) }
  catch (e) { console.warn('Offline copy not available here:', e.message); return getFirestore(app) }
}
export const db = openDb()

// The Widebed PMS project: checks a staff member's PMS email and password at sign-in (see docs/PMS_LINK.md), and
// writes Maintenance ticket changes back to the PMS AS THAT PERSON (src/services/pmsIssues.js), so the PMS rules decide
// what they may change. Its web config is public, like ours; no PMS key is kept here.
const pmsApp = initializeApp({
  apiKey: import.meta.env.VITE_PMS_API_KEY,
  authDomain: import.meta.env.VITE_PMS_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PMS_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_PMS_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_PMS_APP_ID,
}, 'pms')
export const pmsAuth = getAuth(pmsApp)
export const pmsDb = getFirestore(pmsApp)
