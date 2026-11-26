// Friendly error messages (26 Nov 2026). Firebase gives codes such as "permission-denied"; staff see a short sentence
// that says what happened and what to do instead. Use it after a "Could not …:" so the toast reads naturally:
//   ui.toast(`Could not save the task: ${friendly(e)}`, 'error')
const MESSAGES = {
  'permission-denied': 'you don’t have permission to do this. Ask the board or workspace admin if you need it',
  'unauthenticated': 'you have been signed out. Please sign in again',
  'unavailable': 'the server can’t be reached. Check your internet and try again',
  'network-request-failed': 'the server can’t be reached. Check your internet and try again',
  'deadline-exceeded': 'it took too long. Please try again',
  'not-found': 'it no longer exists. Someone may have deleted it',
  'already-exists': 'it already exists',
  'resource-exhausted': 'too many changes at once. Wait a moment and try again',
  'aborted': 'someone else changed it at the same moment. Please try again',
  'failed-precondition': 'it can’t be done right now. Refresh the page and try again',
  'invalid-argument': 'something in it isn’t valid. Check what you typed',
  'out-of-range': 'something in it isn’t valid. Check what you typed',
  'cancelled': 'it was cancelled',
  'too-many-requests': 'too many tries. Wait a minute and try again',
}
const FALLBACK = 'something went wrong. Please try again, and tell IT if it keeps happening'

// the last part of a code: "firestore/permission-denied" or "auth/network-request-failed" -> "permission-denied"
export const codeOf = (e) => String(e?.code ?? '').split('/').pop()

export function friendly(e) {
  if (!e) return FALLBACK
  const code = codeOf(e)
  if (MESSAGES[code]) return MESSAGES[code]
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return MESSAGES.unavailable
  const msg = String(e?.message ?? (typeof e === 'string' ? e : '')).trim()
  // a sentence written for people (our own errors) is kept; raw technical text is not shown
  if (msg && !/^(firebase|firestore|fetch|typeerror|referenceerror)|\[code=|[a-z]+\/[a-z-]+/i.test(msg) && msg.length < 200) return msg.replace(/\.$/, '')
  return FALLBACK
}

// the same, as a whole sentence ("You don’t have permission to do this. …")
export const friendlySentence = (e) => { const t = friendly(e); return t.charAt(0).toUpperCase() + t.slice(1) + '.' }
