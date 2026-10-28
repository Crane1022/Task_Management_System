// The animal library. Adding an animal later = one entry here + its drawing in art/*.js (see docs/COMPANION.md).
// The drawings are loaded on demand (one small file per group), so the app never loads all 25 at once.
import { SKINS } from './catSkins.js'

// Parts a person can recolour. An animal lists only the parts it really has.
export const PARTS = [
  { key: 'body', label: 'Main body' },
  { key: 'secondary', label: 'Secondary (belly, muzzle)' },
  { key: 'face', label: 'Face' },
  { key: 'ear', label: 'Ears' },
  { key: 'inner', label: 'Inner ears' },
  { key: 'eye', label: 'Eyes' },
  { key: 'nose', label: 'Nose / beak' },
  { key: 'paw', label: 'Paws / feet' },
  { key: 'tail', label: 'Tail' },
  { key: 'marking', label: 'Markings (stripes, patches, mask)' },
]

export const CATEGORIES = [
  { id: 'cats', name: 'Original cats' },
  { id: 'pets', name: 'Pets' },
  { id: 'farm', name: 'Farm' },
  { id: 'wild', name: 'Wild' },
  { id: 'water', name: 'Water' },
]

// voice: how the optional sound is made (see sound.js). [start Hz, end Hz], seconds, wave, repeats
const v = (wave, from, to, dur = 0.18, repeat = 1) => ({ wave, from, to, dur, repeat })

const cat = (id, name, skin, artId, extra = {}) => ({
  id, name, category: 'cats', group: 'cats', art: artId,
  palette: { body: skin.fur, face: skin.fur, ear: skin.fur, inner: skin.ear, eye: skin.eye, nose: '#e58a95', paw: skin.fur, tail: skin.fur, marking: skin.mark, secondary: skin.fur, ...extra },
  // plain cats (black, white) have no stripes or patches, so there is no marking colour to change
  parts: ['body', 'face', 'ear', 'inner', 'eye', 'nose', 'paw', 'tail', ...(artId === 'cat' ? [] : ['marking'])],
  voice: v('triangle', 700, 420, 0.28), greeting: skin.msg,
})

export const ANIMALS = [
  cat('cat-orange', 'Orange tabby', SKINS.orange, 'cat-tabby'),
  cat('cat-gray', 'Gray cat', SKINS.gray, 'cat-tabby'),
  cat('cat-black', 'Black cat', SKINS.black, 'cat'),
  cat('cat-white', 'White cat', SKINS.white, 'cat'),
  cat('cat-calico', 'Calico cat', SKINS.calico, 'cat-calico', { tail: '#4a4540' }), // the second patch uses the tail colour, as on the peeking calico

  { id: 'dog', name: 'Dog', category: 'pets', group: 'pets', art: 'dog', greeting: 'woof!',
    palette: { body: '#c58f5a', secondary: '#f1d9b5', face: '#c58f5a', ear: '#8a5a33', eye: '#2b2b2b', nose: '#2b2b2b', paw: '#c58f5a', tail: '#c58f5a' },
    parts: ['body', 'secondary', 'face', 'ear', 'eye', 'nose', 'paw', 'tail'], voice: v('square', 260, 180, 0.12, 2) },
  { id: 'bunny', name: 'Bunny', category: 'pets', group: 'pets', art: 'bunny', greeting: '*sniff sniff*',
    palette: { body: '#f3efe8', secondary: '#ffffff', face: '#f3efe8', ear: '#f3efe8', inner: '#f4b6c2', eye: '#3a2f2f', nose: '#f08fa3', paw: '#f3efe8', tail: '#ffffff' },
    parts: ['body', 'secondary', 'face', 'ear', 'inner', 'eye', 'nose', 'paw', 'tail'], voice: v('sine', 900, 1100, 0.07, 2) },
  { id: 'mouse', name: 'Mouse (Tikus)', category: 'pets', group: 'pets', art: 'mouse', greeting: 'squeak!',
    palette: { body: '#b9bcc4', secondary: '#e6e7ec', face: '#b9bcc4', ear: '#b9bcc4', inner: '#f2a9b8', eye: '#2b2b2b', nose: '#f08fa3', paw: '#f2a9b8', tail: '#f2a9b8' },
    parts: ['body', 'secondary', 'face', 'ear', 'inner', 'eye', 'nose', 'paw', 'tail'], voice: v('sine', 1500, 1900, 0.09, 2) },
  { id: 'hamster', name: 'Hamster', category: 'pets', group: 'pets', art: 'hamster', greeting: 'nom nom',
    palette: { body: '#e7b377', secondary: '#fbf1de', face: '#e7b377', ear: '#d99a58', inner: '#f4b6c2', eye: '#2b2b2b', nose: '#e58a95', paw: '#f4b6c2' },
    parts: ['body', 'secondary', 'face', 'ear', 'inner', 'eye', 'nose', 'paw'], voice: v('sine', 1300, 1700, 0.06, 3) },

  { id: 'chicken', name: 'Chicken', category: 'farm', group: 'farm', art: 'chicken', greeting: 'bok bok!',
    palette: { body: '#fbfaf5', secondary: '#efe9dc', face: '#fbfaf5', ear: '#e63946', eye: '#2b2b2b', nose: '#ff9a1f', paw: '#ff9a1f', tail: '#efe9dc' },
    parts: ['body', 'secondary', 'face', 'ear', 'eye', 'nose', 'paw', 'tail'], voice: v('sawtooth', 500, 380, 0.07, 3) },
  { id: 'pig', name: 'Pig', category: 'farm', group: 'farm', art: 'pig', greeting: 'oink!',
    palette: { body: '#f7b6c2', secondary: '#f08fa3', face: '#f7b6c2', ear: '#f29bb0', eye: '#2b2b2b', nose: '#c8607a', paw: '#f29bb0', tail: '#f29bb0' },
    parts: ['body', 'secondary', 'face', 'ear', 'eye', 'nose', 'paw', 'tail'], voice: v('sawtooth', 220, 150, 0.14, 2) },
  { id: 'cow', name: 'Cow', category: 'farm', group: 'farm', art: 'cow', greeting: 'moo!',
    palette: { body: '#ffffff', secondary: '#f4a6b4', face: '#ffffff', ear: '#f0f0f0', inner: '#f4a6b4', eye: '#2b2b2b', nose: '#c8607a', paw: '#3b3b3b', tail: '#c9c9c9', marking: '#2b2b2b' },
    parts: ['body', 'secondary', 'face', 'ear', 'inner', 'eye', 'nose', 'paw', 'tail', 'marking'], voice: v('sawtooth', 140, 110, 0.5) },
  { id: 'duck', name: 'Duck', category: 'water', group: 'water', art: 'duck', greeting: 'quack!',
    palette: { body: '#ffd23f', secondary: '#ffe58a', face: '#ffd23f', eye: '#2b2b2b', nose: '#ff9a1f', paw: '#ff9a1f', tail: '#ffd23f' },
    parts: ['body', 'secondary', 'face', 'eye', 'nose', 'paw', 'tail'], voice: v('square', 520, 380, 0.09, 2) },

  { id: 'fox', name: 'Fox', category: 'wild', group: 'wild', art: 'fox', greeting: 'ring-ding!',
    palette: { body: '#e8793a', secondary: '#ffffff', face: '#e8793a', ear: '#e8793a', inner: '#2b2b2b', eye: '#2b2b2b', nose: '#2b2b2b', paw: '#3a2a22', tail: '#e8793a' },
    parts: ['body', 'secondary', 'face', 'ear', 'inner', 'eye', 'nose', 'paw', 'tail'], voice: v('triangle', 900, 600, 0.16, 2) },
  { id: 'redpanda', name: 'Red panda', category: 'wild', group: 'wild', art: 'redpanda', greeting: 'chirp!',
    palette: { body: '#c8532b', secondary: '#ffffff', face: '#d9693a', ear: '#c8532b', inner: '#ffffff', eye: '#2b2b2b', nose: '#2b2b2b', paw: '#2e2420', tail: '#c8532b', marking: '#6b2c14' },
    parts: ['body', 'secondary', 'face', 'ear', 'inner', 'eye', 'nose', 'paw', 'tail', 'marking'], voice: v('sine', 1100, 1500, 0.1, 2) },
  { id: 'raccoon', name: 'Raccoon', category: 'wild', group: 'wild', art: 'raccoon', greeting: 'chitter!',
    palette: { body: '#8d9097', secondary: '#f1f1f1', face: '#a4a7ae', ear: '#8d9097', inner: '#35353b', eye: '#f2f2f2', nose: '#2b2b2b', paw: '#3a3a40', tail: '#8d9097', marking: '#35353b' },
    parts: ['body', 'secondary', 'face', 'ear', 'inner', 'eye', 'nose', 'paw', 'tail', 'marking'], voice: v('sawtooth', 800, 700, 0.05, 4) },
  { id: 'koala', name: 'Koala', category: 'wild', group: 'wild', art: 'koala', greeting: 'zzz… hi',
    palette: { body: '#9ea4ad', secondary: '#e9ebee', face: '#9ea4ad', ear: '#9ea4ad', inner: '#f2f2f2', eye: '#2b2b2b', nose: '#2b2b2b', paw: '#7c828b' },
    parts: ['body', 'secondary', 'face', 'ear', 'inner', 'eye', 'nose', 'paw'], voice: v('sawtooth', 120, 90, 0.4) },
  { id: 'bear', name: 'Bear', category: 'wild', group: 'wild', art: 'bear', greeting: 'grr… hello!',
    palette: { body: '#8a5a3b', secondary: '#d9b48a', face: '#8a5a3b', ear: '#8a5a3b', inner: '#d9b48a', eye: '#2b2b2b', nose: '#2b2b2b', paw: '#6d4429', tail: '#8a5a3b' },
    parts: ['body', 'secondary', 'face', 'ear', 'inner', 'eye', 'nose', 'paw', 'tail'], voice: v('sawtooth', 150, 100, 0.35) },
  { id: 'panda', name: 'Panda', category: 'wild', group: 'wild', art: 'panda', greeting: 'munch munch',
    palette: { body: '#ffffff', secondary: '#f1f1f1', face: '#ffffff', ear: '#2b2b2b', eye: '#ffffff', nose: '#2b2b2b', paw: '#2b2b2b', marking: '#2b2b2b' },
    parts: ['body', 'secondary', 'face', 'ear', 'eye', 'nose', 'paw', 'marking'], voice: v('triangle', 350, 280, 0.22) },
  { id: 'capybara', name: 'Capybara', category: 'wild', group: 'wild', art: 'capybara', greeting: 'chill…',
    palette: { body: '#a9744a', secondary: '#c9966a', face: '#b57f52', ear: '#8c5b38', inner: '#6b4426', eye: '#2b2b2b', nose: '#3a2a22', paw: '#8c5b38' },
    parts: ['body', 'secondary', 'face', 'ear', 'inner', 'eye', 'nose', 'paw'], voice: v('sine', 480, 380, 0.2) },
  { id: 'otter', name: 'Otter', category: 'water', group: 'water', art: 'otter', greeting: 'eek eek!',
    palette: { body: '#7a5638', secondary: '#e8d3b5', face: '#8a6445', ear: '#6b4a30', eye: '#2b2b2b', nose: '#2b2b2b', paw: '#5f4128', tail: '#6b4a30' },
    parts: ['body', 'secondary', 'face', 'ear', 'eye', 'nose', 'paw', 'tail'], voice: v('sine', 1000, 1300, 0.12, 2) },
  { id: 'penguin', name: 'Penguin', category: 'water', group: 'water', art: 'penguin', greeting: 'waddle waddle',
    palette: { body: '#2f3a4a', secondary: '#ffffff', face: '#2f3a4a', eye: '#ffffff', nose: '#ff9a1f', paw: '#ff9a1f' },
    parts: ['body', 'secondary', 'face', 'eye', 'nose', 'paw'], voice: v('square', 600, 450, 0.1, 2) },
  { id: 'frog', name: 'Frog', category: 'water', group: 'water', art: 'frog', greeting: 'ribbit!',
    palette: { body: '#6cbf5a', secondary: '#d6f0b8', face: '#6cbf5a', eye: '#2b2b2b', nose: '#3f8f35', paw: '#5aa84a' },
    parts: ['body', 'secondary', 'face', 'eye', 'nose', 'paw'], voice: v('square', 180, 260, 0.1, 2) },
  { id: 'turtle', name: 'Turtle', category: 'water', group: 'water', art: 'turtle', greeting: 'slow and steady',
    palette: { body: '#6a8f4a', secondary: '#4f7438', face: '#9bc36b', eye: '#2b2b2b', nose: '#6f9a45', paw: '#9bc36b', tail: '#9bc36b' },
    parts: ['body', 'secondary', 'face', 'eye', 'nose', 'paw', 'tail'], voice: v('sine', 300, 250, 0.25) },
]

export const DEFAULT_ANIMAL = 'cat-orange'
export const CUSTOM_ID = 'custom' // an uploaded character instead of a built-in animal
export const ORIGINAL_CAT_IDS = ANIMALS.filter((a) => a.category === 'cats').map((a) => a.id)

const byId = new Map(ANIMALS.map((a) => [a.id, a]))
export const getAnimal = (id) => byId.get(id) ?? null
export const hasAnimal = (id) => byId.has(id)

// Search by name, category name or id; optionally within one category
export function searchAnimals({ text = '', category = '', ids = null } = {}) {
  const t = text.trim().toLowerCase()
  return ANIMALS.filter((a) => (!category || a.category === category)
    && (!ids || ids.includes(a.id))
    && (!t || `${a.name} ${a.id} ${CATEGORIES.find((c) => c.id === a.category)?.name}`.toLowerCase().includes(t)))
}
