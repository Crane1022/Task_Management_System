import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The rename box lives in one place only: right under the live preview on the My companion page.
const view = readFileSync(new URL('../src/views/CompanionView.vue', import.meta.url), 'utf8')
const pet = readFileSync(new URL('../src/components/PetCompanion.vue', import.meta.url), 'utf8')

test('there is one rename box, after the live preview heading and not in the appearance form', () => {
  assert.equal(view.match(/id="c-name"/g).length, 1)
  const preview = view.indexOf('<h2 class="h">Live preview</h2>')
  assert.ok(preview > 0)
  assert.ok(view.indexOf('id="c-name"') > preview)
  assert.ok(view.includes('Rename your pet'))
  assert.ok(!view.includes('>Pet name<'))
})
test('the floating pet has no rename control', () => {
  assert.ok(!/rename|Pencil/i.test(pet))
})
