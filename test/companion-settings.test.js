import test from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultSettings, normalizeSettings, effectiveColors, colorsToStyle, selectAnimal, rememberRecent, toggleFavourite,
  resetColor, resetAppearance, resetFace, resetPosition, restoreOriginalAnimal, resetAll, SIZE, NAME_MAX, DEFAULT_POSITION,
} from '../src/companions/settings.js'
import { getAnimal, CUSTOM_ID } from '../src/companions/registry.js'
import { readCache, writeCache, cacheKey } from '../src/companions/localCache.js'
import { reactionAllowed, pickMessage, shouldSleep, SLEEP_AFTER_MS, greetingFor } from '../src/companions/behaviour.js'

const fakeStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), keys: () => [...m.keys()] } }

test('a new person starts with the orange tabby, visible, animations on, sounds off', () => {
  const d = defaultSettings()
  assert.equal(d.animalId, 'cat-orange')
  assert.equal(d.visible, true)
  assert.equal(d.behaviour.animations, true)
  assert.equal(d.behaviour.sounds, false)
  assert.equal(d.behaviour.peekCats, true) // the peeking cats stay on, as before
  assert.deepEqual(d.position, DEFAULT_POSITION)
})

test('whatever is loaded gets cleaned: bad values never reach the screen', () => {
  assert.deepEqual(normalizeSettings(null), defaultSettings())
  assert.deepEqual(normalizeSettings('nonsense'), defaultSettings())
  const n = normalizeSettings({
    animalId: 'dragon', name: '  '.concat('x'.repeat(80)), size: 9999, colors: { body: '#ABCDEF', ear: 'red', hacker: '#000000', eye: 'javascript:1' },
    accessory: 'jetpack', position: { x: 4, y: -2 }, visible: 'yes', favourites: ['fox', 'fox', 'dragon', 7], recents: new Array(20).fill('dog'),
    behaviour: { volume: 900, sounds: 'loud' }, face: { zoom: 99, x: 5 },
  })
  assert.equal(n.animalId, 'cat-orange')
  assert.equal(n.name.length, NAME_MAX)
  assert.equal(n.size, SIZE.max)
  assert.deepEqual(n.colors, { body: '#abcdef' })
  assert.equal(n.accessory, 'none')
  assert.deepEqual(n.position, { x: 1, y: 0 })
  assert.equal(n.visible, true)
  assert.deepEqual(n.favourites, ['fox'])
  assert.deepEqual(n.recents, ['dog'])
  assert.equal(n.behaviour.volume, 100)
  assert.equal(n.behaviour.sounds, false)
  assert.equal(n.face.zoom, 3)
  assert.equal(n.face.x, 1)
  assert.equal(normalizeSettings({ animalId: CUSTOM_ID }).animalId, CUSTOM_ID) // an uploaded character is a valid choice
})

test('selecting different animals', () => {
  let s = defaultSettings()
  for (const id of ['dog', 'bunny', 'mouse', 'hamster', 'capybara', 'cat-calico', 'cow']) { s = selectAnimal(s, id); assert.equal(s.animalId, id) }
  assert.equal(selectAnimal(s, 'unicorn').animalId, 'cow') // an unknown animal is ignored
})

test('switching animals keeps only the colours that still apply', () => {
  let s = { ...defaultSettings(), colors: { body: '#112233', tail: '#445566' } }
  s = selectAnimal(s, 'hamster') // a hamster has no tail
  assert.deepEqual(s.colors, { body: '#112233' })
  const again = selectAnimal(s, 'hamster') // choosing the same animal changes nothing
  assert.deepEqual(again.colors, { body: '#112233' })
})

test('changing colours: the person\'s colours win, the rest stay the animal\'s own', () => {
  const dog = getAnimal('dog')
  const c = effectiveColors('dog', { body: '#00ff00', marking: '#ffffff' })
  assert.equal(c.body, '#00ff00')
  assert.equal(c.ear, dog.palette.ear)
  assert.equal(c.marking, undefined) // a dog has no markings, so a stray marking colour is ignored
  assert.equal(colorsToStyle({ body: '#00ff00' })['--c-body'], '#00ff00')
  assert.deepEqual(effectiveColors('no-such-animal'), {})
})

test('favourites and recently used', () => {
  let s = defaultSettings()
  s = toggleFavourite(s, 'fox'); s = toggleFavourite(s, 'dog')
  assert.deepEqual(s.favourites, ['fox', 'dog'])
  s = toggleFavourite(s, 'fox')
  assert.deepEqual(s.favourites, ['dog'])
  for (const id of ['a', 'dog', 'fox', 'panda', 'duck', 'frog', 'pig', 'cow']) s = rememberRecent(s, id)
  assert.equal(s.recents.length, 6)
  assert.equal(s.recents[0], 'cow')
  s = rememberRecent(s, 'duck')
  assert.equal(s.recents[0], 'duck')
  assert.equal(new Set(s.recents).size, s.recents.length)
})

test('every reset does what it says and nothing else', () => {
  const s = { ...defaultSettings(), animalId: 'fox', name: 'Rusty', accessory: 'crown', colors: { body: '#111111', ear: '#222222' }, size: 150,
    position: { x: 0.2, y: 0.3 }, face: { hasImage: true, stamp: 5, zoom: 2, x: 0.5, y: -0.5 } }
  assert.deepEqual(resetColor(s, 'body').colors, { ear: '#222222' })
  const a = resetAppearance(s)
  assert.deepEqual([a.colors, a.accessory, a.name, a.animalId, a.size], [{}, 'none', '', 'fox', 150])
  assert.deepEqual(resetFace(s).face, defaultSettings().face)
  assert.equal(resetFace(s).animalId, 'fox')
  assert.deepEqual(resetPosition(s).position, DEFAULT_POSITION)
  assert.equal(resetPosition(s).size, 150)
  const o = restoreOriginalAnimal(s)
  assert.deepEqual([o.animalId, o.colors], ['cat-orange', {}])
  assert.equal(o.name, 'Rusty') // restoring the animal does not erase its name
  assert.deepEqual(resetAll(), defaultSettings())
})

test('hiding and showing the companion, and which reactions are allowed', () => {
  const s = defaultSettings()
  assert.equal(reactionAllowed(s, 'completed'), true)
  assert.equal(reactionAllowed({ ...s, visible: false }, 'completed'), false)
  assert.equal(reactionAllowed({ ...s, behaviour: { ...s.behaviour, taskReactions: false } }, 'created'), false)
  assert.equal(reactionAllowed({ ...s, behaviour: { ...s.behaviour, taskReactions: false } }, 'pet'), true) // patting it is not a task reaction
  assert.equal(normalizeSettings({ visible: false }).visible, false)
})

test('saving and restoring: settings survive a round trip and old or partial data is fine', () => {
  const s = normalizeSettings({ ...defaultSettings(), animalId: 'panda', name: 'Bao', colors: { body: '#fafafa' }, size: 120, favourites: ['panda'] })
  assert.deepEqual(normalizeSettings(JSON.parse(JSON.stringify(s))), s)
  const partial = normalizeSettings({ animalId: 'otter' })
  assert.equal(partial.animalId, 'otter')
  assert.equal(partial.size, SIZE.def)
})

test('each person has their own settings, even on the same computer', () => {
  const storage = fakeStorage()
  writeCache('anna', { ...defaultSettings(), animalId: 'fox', name: 'Rusty' }, storage)
  writeCache('ben', { ...defaultSettings(), animalId: 'frog', name: 'Hop' }, storage)
  assert.equal(readCache('anna', storage).animalId, 'fox')
  assert.equal(readCache('ben', storage).animalId, 'frog')
  assert.equal(readCache('carol', storage), null) // someone else gets nothing of theirs
  assert.notEqual(cacheKey('anna'), cacheKey('ben'))
  storage.setItem(cacheKey('dan'), '{broken json')
  assert.equal(readCache('dan', storage), null) // a damaged copy is ignored, not a crash
})

test('behaviour helpers', () => {
  assert.equal(pickMessage('completed', () => 0), 'Well done!')
  assert.ok(typeof pickMessage('unknown-type') === 'string')
  assert.equal(shouldSleep(SLEEP_AFTER_MS, true), true)
  assert.equal(shouldSleep(SLEEP_AFTER_MS - 1, true), false)
  assert.equal(shouldSleep(SLEEP_AFTER_MS * 5, false), false)
  assert.equal(greetingFor(getAnimal('dog'), 'Rex', 'Ana'), 'woof! Hi Ana!')
})
