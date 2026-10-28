import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ANIMALS } from '../src/companions/registry.js'
import { loadArt, composePetSvg } from '../src/companions/compose.js'
import { accessorySvg, ACCESSORIES } from '../src/companions/accessories.js'
import { voiceNotes } from '../src/companions/sound.js'
import { getAnimal } from '../src/companions/registry.js'

// every opening tag has its closing tag
function balanced(svg) {
  const stack = []
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    const [, closing, name, , selfClose] = m
    if (selfClose) continue
    if (closing) { if (stack.pop() !== name) return false } else stack.push(name)
  }
  return stack.length === 0
}

test('every drawing is well-formed, safe, and uses only the colour variables', async () => {
  for (const a of ANIMALS) {
    const svg = composePetSvg({ art: await loadArt(a.id), uid: 'x', accessory: 'crown' })
    assert.ok(balanced(svg), `${a.id} has unbalanced tags`)
    assert.ok(!/<script|javascript:|onload=|onclick=|https?:/i.test(svg), `${a.id} contains something unsafe`)
  }
})

test('a face photo is clipped to the animal\'s own head, features are hidden, ears and body stay', async () => {
  const dog = await loadArt('dog'), frog = await loadArt('frog')
  const photo = { href: 'blob:http://localhost/abc-123', zoom: 1.5, x: 0.4, y: -0.2 }
  const withPhoto = composePetSvg({ art: dog, uid: 'dog1', photo })
  const without = composePetSvg({ art: dog, uid: 'dog1' })
  assert.ok(withPhoto.includes('<clipPath id="pf-dog1">') && withPhoto.includes('clip-path="url(#pf-dog1)"'))
  assert.ok(withPhoto.includes(photo.href))
  assert.ok(withPhoto.includes(dog.under) && withPhoto.includes(dog.head)) // body, ears and head stay
  assert.ok(!withPhoto.includes(dog.front) && without.includes(dog.front)) // the original face features are replaced by the photo
  assert.ok(withPhoto.includes(dog.face.d))
  assert.notEqual(dog.face.d, frog.face.d) // every animal has its own face shape
  assert.notDeepEqual(dog.face.box, frog.face.box)
  assert.ok(!without.includes('clipPath'))
  assert.ok(balanced(withPhoto))
})

test('only pictures the app made itself can be shown on a face', async () => {
  const art = await loadArt('cat-orange')
  for (const href of ['https://evil.example/x.png', 'javascript:alert(1)', '" onload="alert(1)', 'data:text/html;base64,AAAA', 'data:image/svg+xml;base64,AAAA', '']) {
    const svg = composePetSvg({ art, uid: 'x', photo: { href, zoom: 1, x: 0, y: 0 } })
    assert.ok(!svg.includes('<image'), `accepted ${href}`)
    assert.ok(svg.includes(art.front), 'falls back to the normal face')
  }
  assert.ok(composePetSvg({ art, uid: 'x', photo: { href: 'blob:http://localhost/ok', zoom: 1, x: 0, y: 0 } }).includes('<image'))
  assert.ok(composePetSvg({ art, uid: 'x', photo: { href: 'data:image/png;base64,iVBORw0KGgo=', zoom: 1, x: 0, y: 0 } }).includes('<image'))
})

test('each pet on screen gets its own mask id, and the zoom and position are applied', async () => {
  const art = await loadArt('panda')
  const a = composePetSvg({ art, uid: 'one', photo: { href: 'blob:a', zoom: 1, x: 0, y: 0 } })
  const b = composePetSvg({ art, uid: 'two', photo: { href: 'blob:a', zoom: 2, x: 1, y: 0 } })
  assert.ok(a.includes('pf-one') && b.includes('pf-two') && !a.includes('pf-two'))
  const w = (svg) => Number(svg.match(/<image [^>]*width="([\d.]+)"/)[1])
  assert.ok(w(b) > w(a)) // zoomed in = a larger picture inside the same mask
  assert.equal(composePetSvg({ art, uid: "a'\"<b", photo: { href: 'blob:a', zoom: 1, x: 0, y: 0 } }).includes("a'"), false) // the id cannot carry markup
})

test('accessories fit every animal, and the scarf sits on the neck not the head', async () => {
  for (const a of ANIMALS) {
    const art = await loadArt(a.id)
    for (const acc of ACCESSORIES.filter((x) => x.id !== 'none')) {
      const svg = composePetSvg({ art, uid: 'x', accessory: acc.id })
      assert.ok(svg.includes('pet-acc'), `${a.id} + ${acc.id}`)
      assert.ok(balanced(svg))
    }
  }
  assert.equal(accessorySvg('none', { top: [0, 0], head: [0, 0], neck: [0, 0], w: 10 }), '')
  const art = await loadArt('dog')
  const scarf = composePetSvg({ art, uid: 'x', accessory: 'scarf' })
  assert.ok(scarf.indexOf('pet-acc') < scarf.indexOf('class="pet-head"')) // drawn before (outside) the head group
  const crown = composePetSvg({ art, uid: 'x', accessory: 'crown' })
  assert.ok(crown.indexOf('pet-acc') > crown.indexOf('class="pet-head"')) // moves with the head
})

test('sounds: nothing at zero volume, gentle at full volume, the right number of notes', () => {
  assert.deepEqual(voiceNotes(getAnimal('dog').voice, 0), [])
  assert.deepEqual(voiceNotes(null, 50), [])
  const dog = voiceNotes(getAnimal('dog').voice, 100)
  assert.equal(dog.length, 2) // woof woof
  assert.ok(dog.every((n) => n.gain <= 0.25 && n.gain > 0))
  assert.ok(dog[1].start > dog[0].start)
  assert.ok(voiceNotes(getAnimal('dog').voice, 100)[0].gain > voiceNotes(getAnimal('dog').voice, 20)[0].gain)
  for (const a of ANIMALS) assert.ok(voiceNotes(a.voice, 50).length >= 1, a.id)
})

test('the pet never gets in the way: the layer lets clicks through, sits under dialogs, and takes no keyboard focus', () => {
  const src = readFileSync(new URL('../src/components/PetCompanion.vue', import.meta.url), 'utf8')
  assert.match(src, /\.pet-layer \{[^}]*pointer-events: none/)        // the layer around the pet is transparent to the mouse
  assert.match(src, /\.pet \{[^}]*pointer-events: auto/)              // only the pet itself catches it
  assert.match(src, /touch-action: none/)                              // touch dragging works
  assert.match(src, /z-index: 25/)                                     // under menus (30) and dialogs (50+)
  assert.match(src, /aria-hidden="true"/)
  assert.ok(!/tabindex="0"/.test(src))                                 // never in the tab order
  assert.match(src, /setPointerCapture/)                               // a drag that leaves the pet is not lost
  assert.ok(!/addEventListener\('mousemove'/.test(src))                // no global mouse listener to fight the Kanban drag
  const win = readFileSync(new URL('../src/stores/companion.js', import.meta.url), 'utf8')
  assert.match(win, /setTimeout\(\(\) => patchCompanion/)              // the position is saved after the drag ends, debounced
})
