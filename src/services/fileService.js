// Files uploaded to a task, kept in Firestore (see src/utils/files.js for the layout).
// Firestore rules give the files the same permissions as their task: whoever can read the task can open them.
import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from '@/firebase/sdk'
import { db } from '@/firebase/config'
import { addAttachment } from './taskService'
import { CHUNK_CHARS, MAX_CHUNKS, canShrink, cleanName, fileKind, split, openMode } from '@/utils/files'
import { displayOf } from '@/utils/constants'

const metaRef = (taskId, fileId) => doc(db, 'tasks', taskId, 'files', fileId)
const chunkRef = (taskId, fileId, i) => doc(db, 'tasks', taskId, 'files', fileId, 'chunks', String(i))

// ----- reading a file in the browser -----
const readAsDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(r.result)
  r.onerror = () => reject(r.error)
  r.readAsDataURL(blob)
})
const base64Of = async (blob) => String(await readAsDataUrl(blob)).split(',')[1] ?? ''

// Draw the picture smaller until it fits. -> data URL (JPEG), or null if the browser cannot draw it
async function drawSmaller(file, widths, qualities, maxChars) {
  let bmp
  try { bmp = await createImageBitmap(file) } catch { return null }
  for (const width of widths) {
    const scale = Math.min(1, width / bmp.width, width / bmp.height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bmp.width * scale))
    canvas.height = Math.max(1, Math.round(bmp.height * scale))
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff' // a see-through PNG gets a white background instead of black
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    for (const q of qualities) {
      const url = canvas.toDataURL('image/jpeg', q)
      if (url.length < maxChars) return url
    }
  }
  return null
}

// -> { name, type, size, data (base64), thumb }
async function prepare(file) {
  const name = cleanName(file.name, file.type)
  if (canShrink(file)) {
    // a photo is made smaller (at most 1920 px, one piece) and gets a little preview picture for the list
    const big = await drawSmaller(file, [1920, 1440, 1080, 800], [0.85, 0.7, 0.55], CHUNK_CHARS)
    if (big) {
      const thumb = await drawSmaller(file, [160], [0.7, 0.5], 20_000)
      const data = big.split(',')[1]
      return { name: name.replace(/\.(png|webp|bmp)$/i, '.jpg'), type: 'image/jpeg', size: Math.round(data.length * 3 / 4), data, thumb }
    }
  }
  return { name, type: file.type || 'application/octet-stream', size: file.size, data: await base64Of(file), thumb: null }
}

// Upload one file and attach it to the task. onProgress(0..1) is called as the pieces are saved.
export async function uploadTaskFile(taskId, file, user, onProgress) {
  onProgress?.(0.05)
  const p = await prepare(file)
  const parts = split(p.data)
  if (parts.length > MAX_CHUNKS) throw Object.assign(new Error('That file is too big.'), { code: 'file/too-large' })
  const fileId = doc(collection(db, 'tasks', taskId, 'files')).id
  const kind = fileKind(p.name, p.type)
  await setDoc(metaRef(taskId, fileId), {
    name: p.name, type: p.type, size: p.size, kind, chunks: parts.length, complete: false,
    ...(p.thumb ? { thumb: p.thumb } : {}), addedBy: user.id, createdAt: serverTimestamp(),
  })
  try {
    for (let i = 0; i < parts.length; i++) {
      await setDoc(chunkRef(taskId, fileId, i), { data: parts[i] })
      onProgress?.(0.1 + 0.8 * ((i + 1) / parts.length))
    }
    await updateDoc(metaRef(taskId, fileId), { complete: true })
    await addAttachment(taskId, {
      id: fileId, fileId, name: p.name, provider: 'Uploaded', kind, type: p.type, size: p.size,
      addedBy: user.id, addedByName: displayOf(user), addedAt: Date.now(),
    }, user)
    onProgress?.(1)
    return fileId
  } catch (e) {
    await deleteTaskFile(taskId, fileId, parts.length) // do not leave half a file behind
    throw e
  }
}

// the small preview picture of an uploaded photo (null for other files)
const thumbCache = new Map()
export async function fileThumb(taskId, fileId) {
  const key = `${taskId}/${fileId}`
  if (!thumbCache.has(key)) {
    thumbCache.set(key, getDoc(metaRef(taskId, fileId)).then((s) => (s.exists() ? s.data().thumb ?? null : null)).catch(() => null))
  }
  return thumbCache.get(key)
}

// -> a Blob of the whole file
const blobCache = new Map()
export async function loadTaskFile(taskId, attachment) {
  const key = `${taskId}/${attachment.fileId}`
  if (blobCache.has(key)) return blobCache.get(key)
  const meta = await getDoc(metaRef(taskId, attachment.fileId))
  if (!meta.exists()) throw Object.assign(new Error('This file is no longer available.'), { code: 'file/gone' })
  const { chunks, type } = meta.data()
  const parts = await Promise.all(Array.from({ length: chunks }, (_, i) => getDoc(chunkRef(taskId, attachment.fileId, i))))
  if (parts.some((s) => !s.exists())) throw Object.assign(new Error('This file did not finish uploading.'), { code: 'file/incomplete' })
  const text = parts.map((s) => s.data().data).join('')
  const bin = atob(text)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  // only pictures and PDFs keep their real type; anything else is a plain download that can never run as a page
  const mode = openMode(type)
  const blob = new Blob([bytes], { type: mode === 'download' ? 'application/octet-stream' : type })
  blobCache.set(key, blob)
  return blob
}

// Save the file to the computer (or phone)
export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

// Delete the pieces and the file record (after the attachment is taken off the task, or when an upload fails)
export async function deleteTaskFile(taskId, fileId, chunks) {
  try {
    let n = chunks
    if (n == null) {
      const s = await getDoc(metaRef(taskId, fileId))
      n = s.exists() ? s.data().chunks ?? 0 : 0
    }
    const b = writeBatch(db)
    for (let i = 0; i < n; i++) b.delete(chunkRef(taskId, fileId, i))
    b.delete(metaRef(taskId, fileId))
    await b.commit()
  } catch (e) {
    console.warn('Could not delete the uploaded file', fileId, e.code ?? e.message)
    try { await deleteDoc(metaRef(taskId, fileId)) } catch { /* left for later */ }
  }
  thumbCache.delete(`${taskId}/${fileId}`)
  blobCache.delete(`${taskId}/${fileId}`)
}
