import test from 'node:test'
import assert from 'node:assert/strict'
import { stickerUrl, insertAt, EMOJI_GROUPS, BUILT_IN_STICKERS } from '../src/utils/stickers.js'

test('stickerUrl accepts https pictures only', () => {
  assert.equal(stickerUrl('https://example.com/a.png'), 'https://example.com/a.png')
  assert.equal(stickerUrl('http://example.com/a.png'), '', 'plain http is refused')
  assert.equal(stickerUrl('javascript:alert(1)'), '')
  assert.equal(stickerUrl('data:image/png;base64,AAAA'), '', 'picture data is never stored')
  assert.equal(stickerUrl('not a link'), '')
  assert.equal(stickerUrl(`https://example.com/${'a'.repeat(500)}`), '', 'too long for the rule')
})

test('a Google Drive share link becomes the picture address', () => {
  assert.equal(stickerUrl('https://drive.google.com/file/d/AbC_123-x/view?usp=sharing'), 'https://drive.google.com/uc?export=view&id=AbC_123-x')
  assert.equal(stickerUrl('https://drive.google.com/open?id=ZZ9'), 'https://drive.google.com/uc?export=view&id=ZZ9')
  assert.equal(stickerUrl('https://drive.google.com/drive/folders/abc'), '')
})

test('insertAt puts text at the caret', () => {
  assert.deepEqual(insertAt('hello', 2, '😀'), { text: 'he😀llo', caret: 4 })
  assert.deepEqual(insertAt('hi', undefined, '!'), { text: 'hi!', caret: 3 })
})

test('emoji lists are filled and stickers fit the 16-character rule', () => {
  assert.ok(EMOJI_GROUPS.every((g) => g.items.length > 5 && g.items.every(Boolean)))
  assert.ok(BUILT_IN_STICKERS.every((s) => s.length > 0 && s.length <= 16))
})
