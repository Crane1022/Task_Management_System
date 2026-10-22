import { collection, doc, getDoc, setDoc, onSnapshot, serverTimestamp } from '@/firebase/sdk'
import { db } from '@/firebase/config'
import { ROLES } from '@/utils/constants'

// Employee identity = Firebase Auth UID. The Widebed Dashboard reads the same `users` collection.
export async function loadOrCreateProfile(firebaseUser, signup = {}) {
  const ref = doc(db, 'users', firebaseUser.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return { id: snap.id, ...snap.data() }

  const profile = {
    name: signup.name || firebaseUser.displayName || firebaseUser.email.split('@')[0],
    email: firebaseUser.email,
    role: ROLES.EMPLOYEE, // security rules only allow 'employee' on self-create
    departmentId: signup.departmentId || 'operation',
    createdAt: serverTimestamp(),
  }
  await setDoc(ref, profile)
  return { id: firebaseUser.uid, ...profile }
}

export function subscribeUsers(onData, onError) {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => onData(Object.fromEntries(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))),
    onError,
  )
}
