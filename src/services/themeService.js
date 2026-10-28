import { collection, doc, onSnapshot, setDoc, getDoc, deleteDoc, serverTimestamp } from '@/firebase/sdk'
import { db, auth } from '@/firebase/config'
import { galleryUrl } from '@/utils/backgrounds'

// Global and per-page looks live in users/{uid}/settings/appearance (private to the owner).
// Per-dashboard looks are stored on the dashboard document itself (field `theme`).
const settingsRef = (uid) => doc(db, 'users', uid, 'settings', 'appearance')

export const subscribeAppearance = (uid, onData, onError) =>
  onSnapshot(settingsRef(uid), (snap) => onData(snap.exists() ? snap.data() : {}), onError)

export const saveAppearance = (uid, { global, pages }) =>
  setDoc(settingsRef(uid), { ...JSON.parse(JSON.stringify({ global, pages })), updatedAt: serverTimestamp() })

// ---------- background images (Firestore only, no Firebase Storage needed) ----------
// The picture is shrunk in the browser and saved as its own small document in
// users/{uid}/backgrounds/{id}. The appearance settings only keep the image ID.
export const MAX_BYTES = 5 * 1024 * 1024 // largest file we accept before shrinking
const TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_CHARS = 800_000 // a Firestore document must stay under 1 MiB

export function validateImage(file) {
  if (!TYPES.includes(file.type)) return 'Please choose a JPG, PNG or WebP image.'
  if (file.size > MAX_BYTES) return `That image is ${(file.size / 1048576).toFixed(1)} MB. The limit is 5 MB.`
  return ''
}

// Try smaller sizes and lower quality until the picture fits
async function shrink(file) {
  const bmp = await createImageBitmap(file)
  for (const width of [1920, 1440, 1080, 800]) {
    const scale = Math.min(1, width / bmp.width)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
    for (const q of [0.85, 0.7, 0.55]) {
      const url = canvas.toDataURL('image/jpeg', q)
      if (url.length < MAX_CHARS) return url
    }
  }
  throw Object.assign(new Error('too-large'), { code: 'image/too-large' })
}

export async function uploadBackground(uid, file, onProgress) {
  const data = await shrink(file)
  onProgress?.(0.5)
  const ref = doc(collection(db, 'users', uid, 'backgrounds'))
  await setDoc(ref, { data, name: file.name.slice(0, 80), createdAt: serverTimestamp() })
  onProgress?.(1)
  return ref.id
}

export async function deleteBackground(uid, id) {
  try { await deleteDoc(doc(db, 'users', uid, 'backgrounds', id)) } catch (e) { console.warn('Could not delete image', id, e.code) }
}

const urlCache = new Map()
export async function backgroundUrl(bg) {
  if (!bg || bg.type === 'none') return ''
  if (bg.type === 'gallery') return galleryUrl(bg.id)
  if (bg.type === 'upload' && bg.imageId && auth.currentUser) {
    const uid = auth.currentUser.uid
    const key = `${uid}/${bg.imageId}`
    if (!urlCache.has(key)) {
      urlCache.set(key, getDoc(doc(db, 'users', uid, 'backgrounds', bg.imageId)).then((d) => d.data()?.data ?? '').catch(() => ''))
    }
    return urlCache.get(key)
  }
  return ''
}
