import { collection, doc, getDoc, setDoc, updateDoc, onSnapshot } from '@/firebase/sdk'
import { db } from '@/firebase/config'

// Employee identity = the Widebed PMS uid (staff sign in with their PMS account, see docs/PMS_LINK.md).
// Profiles are created by the sign-in function (api/pms-login.js), never by the browser.
export async function loadProfile(firebaseUser) {
  const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// Keeps the signed-in person's profile current (a Director may change their role or department while they are signed in)
export const subscribeProfile = (uid, onData) =>
  onSnapshot(doc(db, 'users', uid), (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null), () => {})

// A person edits only displayName, photo, timezone and landingPage of their own profile (allow-list in firestore.rules)
export const updateOwnProfile = (uid, changes) => updateDoc(doc(db, 'users', uid), changes)

// Notification choices, private to the person (users/{uid}/settings/preferences)
const prefsRef = (uid) => doc(db, 'users', uid, 'settings', 'preferences')
export async function loadPreferences(uid) { return (await getDoc(prefsRef(uid))).data() ?? {} }
export const savePreferences = (uid, prefs) => setDoc(prefsRef(uid), prefs, { merge: true })

// Director (super_admin) only (firestore.rules): department and role, from the Staff page
export const updateUser = (uid, changes) => updateDoc(doc(db, 'users', uid), changes)

export function subscribeUsers(onData, onError) {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => onData(Object.fromEntries(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))),
    onError,
  )
}
