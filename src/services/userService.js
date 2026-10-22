import { collection, doc, getDoc, updateDoc, onSnapshot } from '@/firebase/sdk'
import { db } from '@/firebase/config'

// Employee identity = the Widebed PMS uid (staff sign in with their PMS account, see docs/PMS_LINK.md).
// Profiles are created by the sign-in function (api/pms-login.js), never by the browser.
export async function loadProfile(firebaseUser) {
  const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// Director (super_admin) only (firestore.rules): department and role, from the Staff page
export const updateUser = (uid, changes) => updateDoc(doc(db, 'users', uid), changes)

export function subscribeUsers(onData, onError) {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => onData(Object.fromEntries(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))),
    onError,
  )
}
