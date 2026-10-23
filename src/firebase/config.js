import { initializeApp } from '@/firebase/sdk'
import { getAuth } from '@/firebase/sdk'
import { getFirestore } from '@/firebase/sdk'

// All values come from environment variables (see .env.example). Nothing is hardcoded.
const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

export const auth = getAuth(app)
export const db = getFirestore(app)

// The Widebed PMS project, used only to check a staff member's PMS email and password at sign-in
// (see docs/PMS_LINK.md). Its web config is public, like ours; it never reads or writes PMS data.
const pmsApp = initializeApp({
  apiKey: import.meta.env.VITE_PMS_API_KEY,
  authDomain: import.meta.env.VITE_PMS_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PMS_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_PMS_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_PMS_APP_ID,
}, 'pms')
export const pmsAuth = getAuth(pmsApp)
