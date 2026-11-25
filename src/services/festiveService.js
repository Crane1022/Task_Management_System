import { collection, doc, onSnapshot, query, where, setDoc, addDoc, deleteDoc, serverTimestamp } from '@/firebase/sdk'
import { db } from '@/firebase/config'
import { normalizeSettings, normalizeEvent } from '@/companions/festive'

// Festive companion (25 Nov 2026)
//   festive/settings            the whole-company switches (Directors write, everyone signed in reads)
//   festive_events/{id}         one special day; audience 'all' or 'selected' (+ audienceIds). Firestore only lets a
//                               person read the events meant for them (firestore.rules), so the app asks for exactly those.
//   users/{uid}/settings/festive   the person's own: wardrobe, pop-ups seen, effects off, birthday (private to them)
const settingsRef = doc(db, 'festive', 'settings')
const eventsRef = collection(db, 'festive_events')
const mineRef = (uid) => doc(db, 'users', uid, 'settings', 'festive')

export const subscribeFestiveSettings = (onData, onError) =>
  onSnapshot(settingsRef, (snap) => onData(normalizeSettings(snap.exists() ? snap.data() : null)), onError)
export const saveFestiveSettings = (data) => setDoc(settingsRef, { ...normalizeSettings(data), updatedAt: serverTimestamp() })

const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...normalizeEvent(d.data()) }))
// Directors see every event (to manage them); everyone else gets the events for everyone plus the ones they were picked for
export function subscribeFestiveEvents(uid, isDirector, onData, onError) {
  if (isDirector) return onSnapshot(eventsRef, (snap) => onData(rows(snap)), onError)
  let all = [], mine = []
  const emit = () => onData([...all, ...mine.filter((e) => !all.some((a) => a.id === e.id))])
  const stops = [
    onSnapshot(query(eventsRef, where('audience', '==', 'all')), (snap) => { all = rows(snap); emit() }, onError),
    onSnapshot(query(eventsRef, where('audienceIds', 'array-contains', uid)), (snap) => { mine = rows(snap); emit() }, onError),
  ]
  return () => stops.forEach((s) => s())
}
export async function saveFestiveEvent(id, data, uid) {
  const clean = { ...normalizeEvent(data), updatedAt: serverTimestamp(), updatedBy: uid }
  if (id) { await setDoc(doc(eventsRef, id), clean); return id }
  return (await addDoc(eventsRef, { ...clean, createdAt: serverTimestamp() })).id
}
export const deleteFestiveEvent = (id) => deleteDoc(doc(eventsRef, id))

export const MINE_DEFAULT = { owned: [], seenPopups: [], seenUnlocks: [], effectsOff: false, birthday: '' }
const cleanMine = (raw) => ({
  owned: Array.isArray(raw?.owned) ? raw.owned.filter((x) => typeof x === 'string').slice(0, 60) : [],
  seenPopups: Array.isArray(raw?.seenPopups) ? raw.seenPopups.filter((x) => typeof x === 'string').slice(-80) : [],
  seenUnlocks: Array.isArray(raw?.seenUnlocks) ? raw.seenUnlocks.filter((x) => typeof x === 'string').slice(0, 60) : [],
  effectsOff: raw?.effectsOff === true,
  birthday: /^\d{2}-\d{2}$/.test(raw?.birthday ?? '') ? raw.birthday : '',
})
export const subscribeMyFestive = (uid, onData, onError) => onSnapshot(mineRef(uid), (snap) => onData(cleanMine(snap.exists() ? snap.data() : null)), onError)
export const patchMyFestive = (uid, patch) => setDoc(mineRef(uid), { ...patch, updatedAt: serverTimestamp() }, { merge: true })

// ----- outside data -----
// Weather: Open-Meteo (free, no key). The current 15-minute reading: { code, mm (rain in the last 15 minutes), time }.
export async function fetchWeather(lat, lon) {
  const q = `latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=weather_code,precipitation&timezone=auto`
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`)
  if (!r.ok) throw new Error(`Weather ${r.status}`)
  const c = (await r.json())?.current ?? {}
  return { code: Number.isFinite(c.weather_code) ? c.weather_code : null, mm: Number.isFinite(c.precipitation) ? c.precipitation : 0, time: c.time ?? '' }
}
// Buka puasa: today's maghrib time for a JAKIM zone, through our own server route (api/prayer-times.js). 'HH:MM' or ''.
export async function fetchMaghrib(zone) {
  const r = await fetch(`/api/prayer-times?zone=${encodeURIComponent(zone)}`)
  if (!r.ok) throw new Error(`Prayer times ${r.status}`)
  const j = await r.json()
  return typeof j?.maghrib === 'string' ? j.maghrib : ''
}
