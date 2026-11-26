// Rules for files uploaded to a task. The files are kept in Firestore (no Firebase Storage needed):
//   tasks/{taskId}/files/{fileId}            name, type, size, a small preview picture for images
//   tasks/{taskId}/files/{fileId}/chunks/{n} the file itself, in pieces (one Firestore document holds at most 1 MiB)
import { kindOf } from './links.js'

export const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB per file (photos are made smaller first, so any photo fits)
export const CHUNK_CHARS = 700_000 // characters of base64 text per piece, well under the 1 MiB document limit
export const MAX_CHUNKS = Math.ceil(Math.ceil(MAX_FILE_BYTES / 3) * 4 / CHUNK_CHARS) // 10

// Programs and web pages could do harm when someone opens them, so they cannot be uploaded.
const BLOCKED = /\.(exe|msi|bat|cmd|com|scr|pif|cpl|vbs|vbe|js|jse|wsf|wsh|ps1|psm1|sh|jar|apk|app|dll|sys|reg|lnk|hta|html?|xhtml|mht|php)$/i

// Photos that the browser can draw and make smaller. (A GIF stays a file so its animation is kept.)
const SHRINKABLE = /^image\/(jpeg|png|webp|bmp)$/
// Pictures that are safe to show inside the app. SVG is left out: it can contain scripts.
export const SAFE_IMAGE = /^image\/(jpeg|png|webp|gif|bmp)$/

export const canShrink = (file) => SHRINKABLE.test(file.type)

// -> null when the file can be uploaded, otherwise a sentence for the person
export function checkFile(file) {
  const name = String(file?.name ?? '')
  if (!file || !file.size) return 'That file is empty.'
  if (BLOCKED.test(name)) return `“${name}” cannot be uploaded: programs and web pages are blocked for safety. Zip it first or share a link.`
  if (!canShrink(file) && file.size > MAX_FILE_BYTES) return `“${name}” is ${formatSize(file.size)}. Files can be up to ${formatSize(MAX_FILE_BYTES)}. For bigger files, add a link to Google Drive or OneDrive instead.`
  return null
}

export function formatSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, '')} MB`
}

// a screenshot pasted with Ctrl+V has no real name
export function cleanName(name, type = '') {
  const n = String(name ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 120)
  if (n && n !== 'image.png') return n
  const ext = (type.split('/')[1] ?? 'png').replace('jpeg', 'jpg')
  const d = new Date()
  const p = (x) => String(x).padStart(2, '0')
  return `Screenshot ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.${ext}`
}

export const fileKind = (name, type = '') => (SAFE_IMAGE.test(type) ? 'image' : kindOf(name))

// base64 text -> pieces, and back
export function split(text, size = CHUNK_CHARS) {
  const out = []
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size))
  return out.length ? out : ['']
}

// How a downloaded file is opened. Only plain pictures are shown in the app and only PDFs open in a tab;
// everything else is saved as a download, so a file can never run as a web page.
export function openMode(type) {
  if (SAFE_IMAGE.test(type)) return 'image'
  if (type === 'application/pdf') return 'pdf'
  return 'download'
}
