import test from 'node:test'
import assert from 'node:assert/strict'
import { ANIMALS, CATEGORIES, PARTS, ORIGINAL_CAT_IDS, DEFAULT_ANIMAL, getAnimal, hasAnimal, searchAnimals } from '../src/companions/registry.js'
import { SKINS } from '../src/companions/catSkins.js'
import { loadArt, composePetSvg, artGroups } from '../src/companions/compose.js'

const REQUESTED = ['dog', 'bunny', 'mouse', 'hamster', 'capybara', 'panda', 'bear', 'duck', 'fox', 'penguin', 'frog', 'turtle', 'redpanda', 'otter', 'raccoon', 'koala', 'chicken', 'pig', 'cow']

test('the library has the cat plus every requested animal, and the five original cats', () => {
  for (const id of REQUESTED) assert.ok(hasAnimal(id), `missing ${id}`)
  assert.deepEqual(ORIGINAL_CAT_IDS, ['cat-orange', 'cat-gray', 'cat-black', 'cat-white', 'cat-calico'])
  assert.equal(ANIMALS.length, 24) // 5 cats + 19 other animals (the "cat" of the request is the five cats)
  assert.equal(DEFAULT_ANIMAL, 'cat-orange')
})

test('every animal is complete and ids are unique', () => {
  assert.equal(new Set(ANIMALS.map((a) => a.id)).size, ANIMALS.length)
  const partKeys = PARTS.map((p) => p.key)
  for (const a of ANIMALS) {
    assert.ok(CATEGORIES.some((c) => c.id === a.category), `${a.id} category`)
    assert.ok(artGroups().includes(a.group), `${a.id} group`)
    assert.ok(a.name && a.greeting && a.voice, a.id)
    for (const p of a.parts) { assert.ok(partKeys.includes(p), `${a.id} unknown part ${p}`); assert.match(a.palette[p], /^#[0-9a-f]{6}$/i, `${a.id}.${p}`) }
  }
})

test('the five original cats keep their original colours (shared with the peeking cats)', () => {
  const map = { 'cat-orange': 'orange', 'cat-gray': 'gray', 'cat-black': 'black', 'cat-white': 'white', 'cat-calico': 'calico' }
  for (const [id, skin] of Object.entries(map)) {
    const a = getAnimal(id), k = SKINS[skin]
    assert.equal(a.palette.body, k.fur, `${id} fur`)
    assert.equal(a.palette.inner, k.ear, `${id} inner ear`)
    assert.equal(a.palette.eye, k.eye, `${id} eyes`)
    assert.equal(a.palette.marking, k.mark, `${id} marking`)
    assert.equal(a.greeting, k.msg, `${id} greeting`)
  }
  assert.equal(getAnimal('cat-calico').palette.tail, '#4a4540') // the calico's second patch and tail, as on the peeking calico
})

test('search finds animals by name, by the Malay word, by id and by category', () => {
  assert.deepEqual(searchAnimals({ text: 'tikus' }).map((a) => a.id), ['mouse'])
  assert.deepEqual(searchAnimals({ text: 'bunny' }).map((a) => a.id), ['bunny'])
  assert.equal(searchAnimals({ text: 'PANDA' }).length, 2) // panda and red panda
  assert.equal(searchAnimals({ category: 'cats' }).length, 5)
  assert.deepEqual(searchAnimals({ ids: ['fox', 'dog'] }).map((a) => a.id).sort(), ['dog', 'fox'])
  assert.deepEqual(searchAnimals({ text: 'zzz' }), [])
  assert.ok(searchAnimals({ text: 'water' }).length > 0) // category names are searchable too
})

test('every animal has a drawing, and the drawings are genuinely different (not one body recoloured)', async () => {
  const seen = new Map()
  for (const a of ANIMALS) {
    const art = await loadArt(a.id)
    assert.ok(art && art.under && art.head && art.front && art.face?.d && art.face?.box?.length === 4 && art.anchors?.top, `${a.id} art`)
    const svg = composePetSvg({ art, uid: a.id })
    assert.ok(svg.length > 300, `${a.id} is drawn`)
    if (seen.has(art)) continue // the three cat looks share their art object only by id; checked below
    seen.set(art, a.id)
  }
  const markup = new Map()
  for (const a of ANIMALS.filter((x) => x.category !== 'cats')) {
    const m = composePetSvg({ art: await loadArt(a.id), uid: 'x' })
    assert.ok(!markup.has(m), `${a.id} is identical to ${markup.get(m)}`)
    markup.set(m, a.id)
  }
  // an animal does not reuse the cat's head or ears
  const catHead = (await loadArt('cat-orange')).head
  for (const a of ANIMALS.filter((x) => x.category !== 'cats')) assert.notEqual((await loadArt(a.id)).head, catHead, a.id)
  // the three cat looks differ only by their markings
  const plain = composePetSvg({ art: await loadArt('cat-black') }), tabby = composePetSvg({ art: await loadArt('cat-orange') }), calico = composePetSvg({ art: await loadArt('cat-calico') })
  assert.ok(new Set([plain, tabby, calico]).size === 3)
  assert.ok(tabby.includes('stroke-linecap="round"') && !plain.includes('M50 23v8'))
})

test('every colour part an animal offers really appears in its drawing, so a swatch always changes something', async () => {
  const cssName = { secondary: 'secondary', marking: 'marking' }
  for (const a of ANIMALS) {
    const svg = composePetSvg({ art: await loadArt(a.id), uid: 'x' })
    for (const p of a.parts) assert.ok(svg.includes(`var(--c-${cssName[p] ?? p})`), `${a.id}: "${p}" is offered but not drawn`)
  }
})
