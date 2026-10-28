// Companion settings: defaults, cleaning of whatever is loaded, and helpers. No Firebase in here (testable).
import { ANIMALS, CUSTOM_ID, DEFAULT_ANIMAL, PARTS, getAnimal, hasAnimal } from './registry.js'
import { ACCESSORY_IDS } from './accessories.js'

export const VERSION = 1
export const SIZE = { min: 56, max: 200, def: 96 }
export const NAME_MAX = 24
export const DEFAULT_POSITION = { x: 0.9, y: 0.8 } // centre of the pet as a share of the window, so it adapts to any screen size

export const defaultSettings = () => ({
  v: VERSION,
  animalId: DEFAULT_ANIMAL,
  name: '',
  colors: {},
  accessory: 'none',
  size: SIZE.def,
  position: { ...DEFAULT_POSITION },
  visible: true,
  favourites: [],
  recents: [],
  custom: { hasImage: false, stamp: 0 }, // the uploaded character's picture itself stays on this device
  face: { hasImage: false, stamp: 0, zoom: 1, x: 0, y: 0 },
  behaviour: { animations: true, sounds: false, volume: 40, taskReactions: true, greeting: true, sleep: true, peekCats: true },
})

const HEX = /^#[0-9a-f]{6}$/i
const num = (n, min, max, fallback) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback)
const bool = (b, fallback) => (typeof b === 'boolean' ? b : fallback)
const ids = (list, max) => [...new Set(Array.isArray(list) ? list : [])].filter((id) => typeof id === 'string' && (id === CUSTOM_ID || hasAnimal(id))).slice(0, max)

// Turns anything stored (old versions, missing fields, hand-edited values) into valid settings
export function normalizeSettings(raw) {
  const d = defaultSettings()
  if (!raw || typeof raw !== 'object') return d
  const b = raw.behaviour ?? {}
  const colors = {}
  const valid = new Set(PARTS.map((p) => p.key))
  for (const [k, v] of Object.entries(raw.colors ?? {})) if (valid.has(k) && typeof v === 'string' && HEX.test(v)) colors[k] = v.toLowerCase()
  const animalId = raw.animalId === CUSTOM_ID || hasAnimal(raw.animalId) ? raw.animalId : d.animalId
  return {
    v: VERSION,
    animalId,
    name: typeof raw.name === 'string' ? raw.name.trim().slice(0, NAME_MAX) : '',
    colors,
    accessory: ACCESSORY_IDS.includes(raw.accessory) ? raw.accessory : 'none',
    size: Math.round(num(raw.size, SIZE.min, SIZE.max, SIZE.def)),
    position: { x: num(raw.position?.x, 0, 1, d.position.x), y: num(raw.position?.y, 0, 1, d.position.y) },
    visible: bool(raw.visible, true),
    favourites: ids(raw.favourites, 50),
    recents: ids(raw.recents, 6),
    custom: { hasImage: bool(raw.custom?.hasImage, false), stamp: num(raw.custom?.stamp, 0, Number.MAX_SAFE_INTEGER, 0) },
    face: {
      hasImage: bool(raw.face?.hasImage, false), stamp: num(raw.face?.stamp, 0, Number.MAX_SAFE_INTEGER, 0),
      zoom: num(raw.face?.zoom, 1, 3, 1), x: num(raw.face?.x, -1, 1, 0), y: num(raw.face?.y, -1, 1, 0),
    },
    behaviour: {
      animations: bool(b.animations, true), sounds: bool(b.sounds, false), volume: Math.round(num(b.volume, 0, 100, 40)),
      taskReactions: bool(b.taskReactions, true), greeting: bool(b.greeting, true), sleep: bool(b.sleep, true), peekCats: bool(b.peekCats, true),
    },
  }
}

// What an animal's colours are right now: its own defaults plus the person's changes (only for parts it really has)
export function effectiveColors(animalId, overrides = {}) {
  const a = getAnimal(animalId)
  if (!a) return {}
  const out = {}
  for (const part of a.parts) out[part] = overrides[part] ?? a.palette[part]
  // parts the animal does not list still need a value because the drawing may reference them
  for (const [k, v] of Object.entries(a.palette)) if (!(k in out)) out[k] = v
  return out
}
export const colorsToStyle = (colors) => Object.fromEntries(Object.entries(colors).map(([k, v]) => [`--c-${k}`, v]))

// Moving to another animal keeps what still applies and drops what does not
export function selectAnimal(settings, animalId) {
  if (animalId !== CUSTOM_ID && !hasAnimal(animalId)) return settings
  const a = getAnimal(animalId)
  const colors = a ? Object.fromEntries(Object.entries(settings.colors).filter(([k]) => a.parts.includes(k))) : {}
  return { ...settings, animalId, colors: animalId === settings.animalId ? settings.colors : colors }
}
export const rememberRecent = (settings, animalId) => ({ ...settings, recents: [animalId, ...settings.recents.filter((i) => i !== animalId)].slice(0, 6) })
export const toggleFavourite = (settings, animalId) => ({
  ...settings,
  favourites: settings.favourites.includes(animalId) ? settings.favourites.filter((i) => i !== animalId) : [...settings.favourites, animalId],
})

// ----- the resets -----
export const resetColor = (s, part) => { const colors = { ...s.colors }; delete colors[part]; return { ...s, colors } }
export const resetAppearance = (s) => ({ ...s, colors: {}, accessory: 'none', name: '' })
export const resetFace = (s) => ({ ...s, face: { ...defaultSettings().face } })
export const resetPosition = (s) => ({ ...s, position: { ...DEFAULT_POSITION } })
export const restoreOriginalAnimal = (s) => ({ ...selectAnimal(s, DEFAULT_ANIMAL), colors: {} })
// Everything back to how a new person starts (the picture flags are cleared too; deleting the files is done by the store)
export const resetAll = () => defaultSettings()

// "Hide companion": a switch, so a hidden pet is easy to bring back
export const isShown = (s) => s.visible

export const ANIMAL_COUNT = ANIMALS.length
