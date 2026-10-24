import { doc, onSnapshot, setDoc, serverTimestamp } from '@/firebase/sdk'
import { db } from '@/firebase/config'
import { normalizeSettings } from '@/companions/settings'

// Each person's companion settings: users/{uid}/settings/companion (private to them; the existing settings rule covers it).
// Only settings are stored here. Pictures stay on the device (see companions/imageStore.js).
const ref = (uid) => doc(db, 'users', uid, 'settings', 'companion')

export const subscribeCompanion = (uid, onData, onError) =>
  onSnapshot(ref(uid), (snap) => onData(snap.exists() ? normalizeSettings(snap.data()) : null), onError)

export const saveCompanion = (uid, settings) =>
  setDoc(ref(uid), { ...JSON.parse(JSON.stringify(settings)), updatedAt: serverTimestamp() })

// Changes a few fields without touching the rest (used for the position, so dragging never overwrites other settings)
export const patchCompanion = (uid, patch) =>
  setDoc(ref(uid), { ...JSON.parse(JSON.stringify(patch)), updatedAt: serverTimestamp() }, { merge: true })
