import {
  collection, doc, onSnapshot, updateDoc, writeBatch, serverTimestamp,
} from '@/firebase/sdk'
import { db } from '@/firebase/config'
import { KEEP, newestFirst } from '@/utils/notifications'

// Notifications are kept per person in users/{uid}/notifications (firestore.rules: only the owner reads, marks read or deletes;
// anyone signed in can add one for someone else, but only as themselves).
const inbox = (uid) => collection(db, 'users', uid, 'notifications')

export function subscribeNotifications(uid, onData, onError) {
  return onSnapshot(inbox(uid), (snap) => onData(newestFirst(snap.docs.map((d) => ({ id: d.id, ...d.data() })))), onError)
}

// items = [{ uid, data }]. One write for all. Best effort: the caller decides what to do with a failure.
export async function sendNotifications(items) {
  if (!items.length) return
  const batch = writeBatch(db)
  for (const { uid, data } of items) batch.set(doc(inbox(uid)), { ...data, createdAt: serverTimestamp() })
  await batch.commit()
}

export const markRead = (uid, id) => updateDoc(doc(db, 'users', uid, 'notifications', id), { read: true })

async function batched(uid, ids, apply) {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db)
    ids.slice(i, i + 400).forEach((id) => apply(batch, doc(db, 'users', uid, 'notifications', id)))
    await batch.commit()
  }
}
export const markAllRead = (uid, ids) => batched(uid, ids, (b, ref) => b.update(ref, { read: true }))
export const removeMany = (uid, ids) => batched(uid, ids, (b, ref) => b.delete(ref))

// Keeps only the newest KEEP; returns the ids that should go
export const surplus = (items) => items.slice(KEEP).map((n) => n.id)
