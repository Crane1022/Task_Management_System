// Checks an uploaded picture BEFORE it is used: the type the browser reports, the size, and the file's own first bytes
// (so a renamed or corrupted file is caught, not just trusted by its name).
export const MAX_BYTES = 5 * 1024 * 1024
export const ALLOWED = ['image/png', 'image/jpeg', 'image/webp']
export const ACCEPT = 'image/png,image/jpeg,image/webp'

// 'image/png' | 'image/jpeg' | 'image/webp' | '' from the first bytes of the file
export function sniffImageType(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  return ''
}

// Returns '' when fine, otherwise a sentence for the person. `head` = the first bytes of the file.
export function checkImage({ type, size }, head) {
  if (!ALLOWED.includes(type)) return 'Please choose a PNG, JPG or WebP picture.'
  if (!size) return 'That file is empty.'
  if (size > MAX_BYTES) return `That picture is ${(size / 1048576).toFixed(1)} MB. The limit is 5 MB.`
  if (head) {
    const real = sniffImageType(head)
    if (!real) return 'That file does not look like a real picture. It may be damaged or renamed.'
    if (real !== type) return 'The file type does not match its contents. Please choose a different picture.'
  }
  return ''
}

// Browser helper: validates a File, reading its first bytes
export async function validateFile(file) {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  return checkImage({ type: file.type, size: file.size }, head)
}
