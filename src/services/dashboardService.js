import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, serverTimestamp,
} from '@/firebase/sdk'
import { db } from '@/firebase/config'

const ref = collection(db, 'dashboards')

// Each person owns their own dashboards (private to them, enforced in firestore.rules).
export function subscribeDashboards(uid, onData, onError) {
  return onSnapshot(
    query(ref, where('ownerId', '==', uid)),
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      items.sort((a, b) => (a.createdAt?.seconds ?? 9e15) - (b.createdAt?.seconds ?? 9e15))
      onData(items)
    },
    onError,
  )
}

export const createDashboard = (uid, name, widgets, palette = 'moss') =>
  addDoc(ref, { ownerId: uid, name, widgets, palette, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })

export const saveDashboard = (id, changes) => updateDoc(doc(db, 'dashboards', id), { ...changes, updatedAt: serverTimestamp() })
export const deleteDashboard = (id) => deleteDoc(doc(db, 'dashboards', id))
