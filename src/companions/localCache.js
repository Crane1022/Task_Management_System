// A copy of the settings on this device, so the pet appears at once on page load (before Firestore answers).
// Keyed by uid: another person on the same browser has their own copy and never sees this one.
import { normalizeSettings } from './settings.js'
export const cacheKey = (uid) => `wb-companion:${uid}`

export function readCache(uid, storage = globalThis.localStorage) {
  try { const raw = storage?.getItem(cacheKey(uid)); return raw ? normalizeSettings(JSON.parse(raw)) : null } catch { return null }
}
export function writeCache(uid, settings, storage = globalThis.localStorage) {
  try { storage?.setItem(cacheKey(uid), JSON.stringify(settings)); return true } catch { return false }
}
export function clearCache(uid, storage = globalThis.localStorage) {
  try { storage?.removeItem(cacheKey(uid)) } catch { /* nothing to clear */ }
}
