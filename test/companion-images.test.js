import test from 'node:test'
import assert from 'node:assert/strict'
import { sniffImageType, checkImage, MAX_BYTES } from '../src/companions/imageValidate.js'
import { createImageStore, memoryKv, imageKey } from '../src/companions/imageStore.js'

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46])
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50])
const GIF = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])

test('real pictures are recognised by their first bytes', () => {
  assert.equal(sniffImageType(PNG), 'image/png')
  assert.equal(sniffImageType(JPG), 'image/jpeg')
  assert.equal(sniffImageType(WEBP), 'image/webp')
  assert.equal(sniffImageType(GIF), '')
  assert.equal(sniffImageType(new Uint8Array(0)), '')
  assert.equal(sniffImageType(Uint8Array.from([1, 2, 3])), '')
})

test('valid pictures are accepted (PNG, JPG, WebP, transparent ones included)', () => {
  assert.equal(checkImage({ type: 'image/png', size: 5000 }, PNG), '')
  assert.equal(checkImage({ type: 'image/jpeg', size: 5000 }, JPG), '')
  assert.equal(checkImage({ type: 'image/webp', size: 5000 }, WEBP), '')
  assert.equal(checkImage({ type: 'image/png', size: MAX_BYTES }, PNG), '') // exactly at the limit
})

test('unsupported formats are rejected with a clear message', () => {
  for (const type of ['image/gif', 'image/svg+xml', 'image/bmp', 'application/pdf', 'text/html', '']) {
    assert.match(checkImage({ type, size: 100 }, GIF), /PNG, JPG or WebP/, type)
  }
})

test('too big, empty, renamed or damaged files are rejected', () => {
  assert.match(checkImage({ type: 'image/png', size: MAX_BYTES + 1 }, PNG), /5 MB/)
  assert.match(checkImage({ type: 'image/png', size: 0 }, PNG), /empty/)
  assert.match(checkImage({ type: 'image/png', size: 100 }, GIF), /does not look like a real picture/) // a GIF renamed .png
  assert.match(checkImage({ type: 'image/png', size: 100 }, Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])), /does not look like a real picture/) // random bytes
  assert.match(checkImage({ type: 'image/png', size: 100 }, JPG), /does not match/) // a JPG labelled as PNG
})

test('pictures are stored per person and can be replaced, read back and deleted', async () => {
  const store = createImageStore(memoryKv())
  const a = new Blob(['anna-custom']), b = new Blob(['ben-custom']), face = new Blob(['anna-face'])
  await store.put('anna', 'custom', a)
  await store.put('ben', 'custom', b)
  await store.put('anna', 'face', face)
  assert.equal(await store.get('anna', 'custom'), a)
  assert.equal(await store.get('ben', 'custom'), b) // each person has their own
  assert.equal(await store.get('carol', 'custom'), null)
  assert.notEqual(imageKey('anna', 'custom'), imageKey('ben', 'custom'))
  const a2 = new Blob(['replacement'])
  await store.put('anna', 'custom', a2) // replace
  assert.equal(await store.get('anna', 'custom'), a2)
  await store.del('anna', 'custom') // delete the custom companion
  assert.equal(await store.get('anna', 'custom'), null)
  assert.equal(await store.get('anna', 'face'), face) // the face photo was not touched
  await store.clear('anna') // reset all
  assert.equal(await store.get('anna', 'face'), null)
  assert.equal(await store.get('ben', 'custom'), b) // and nobody else's was touched
})
