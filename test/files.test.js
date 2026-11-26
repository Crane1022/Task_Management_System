import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkFile, formatSize, cleanName, fileKind, split, openMode, canShrink, MAX_FILE_BYTES, CHUNK_CHARS, MAX_CHUNKS } from '../src/utils/files.js'

const f = (name, size, type = '') => ({ name, size, type })

test('ordinary office files and pictures can be uploaded', () => {
  for (const file of [f('Quote.pdf', 900_000, 'application/pdf'), f('Report.docx', 2e6), f('KPI.xlsx', 4e6), f('photo.jpg', 12e6, 'image/jpeg'), f('plans.zip', 5e6)]) {
    assert.equal(checkFile(file), null, file.name)
  }
})

test('programs, web pages, empty and too-big files are refused with a reason', () => {
  assert.match(checkFile(f('setup.exe', 100)), /blocked/)
  assert.match(checkFile(f('invoice.HTML', 100)), /blocked/)
  assert.match(checkFile(f('run.ps1', 100)), /blocked/)
  assert.match(checkFile(f('empty.txt', 0)), /empty/)
  assert.match(checkFile(f('video.mp4', MAX_FILE_BYTES + 1, 'video/mp4')), /up to 5 MB/)
  // a big photo is fine: it is made smaller before it is saved
  assert.equal(checkFile(f('big.png', 30e6, 'image/png')), null)
  // ...but a big GIF is kept as it is, so the size limit applies
  assert.match(checkFile(f('big.gif', 30e6, 'image/gif')), /up to 5 MB/)
})

test('which pictures are made smaller and which are shown in the app', () => {
  assert.ok(canShrink(f('a.png', 1, 'image/png')))
  assert.ok(!canShrink(f('a.gif', 1, 'image/gif')))
  assert.ok(!canShrink(f('a.svg', 1, 'image/svg+xml')))
  assert.equal(openMode('image/jpeg'), 'image')
  assert.equal(openMode('application/pdf'), 'pdf')
  assert.equal(openMode('image/svg+xml'), 'download') // SVG can hold scripts: never shown in the app
  assert.equal(openMode('text/html'), 'download')
  assert.equal(fileKind('photo.jpg', 'image/jpeg'), 'image')
  assert.equal(fileKind('Quote.pdf', 'application/pdf'), 'pdf')
  assert.equal(fileKind('KPI.xlsx', ''), 'excel')
})

test('sizes and names read nicely', () => {
  assert.equal(formatSize(512), '512 B')
  assert.equal(formatSize(2048), '2 KB')
  assert.equal(formatSize(5 * 1024 * 1024), '5 MB')
  assert.equal(formatSize(1.5 * 1024 * 1024), '1.5 MB')
  assert.match(cleanName('image.png', 'image/png'), /^Screenshot \d{4}-\d\d-\d\d \d\d\.\d\d\.png$/) // a pasted screenshot
  assert.equal(cleanName('a/b:c?.pdf'), 'a_b_c_.pdf')
})

test('a 5 MB file fits in the pieces the rules allow', () => {
  const base64 = Math.ceil(MAX_FILE_BYTES / 3) * 4
  assert.equal(MAX_CHUNKS, 10)
  assert.ok(split('x'.repeat(base64)).length <= MAX_CHUNKS)
  const parts = split('abcdefghij', 4)
  assert.deepEqual(parts, ['abcd', 'efgh', 'ij'])
  assert.equal(parts.join(''), 'abcdefghij')
  assert.ok(CHUNK_CHARS <= 700_000)
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
  assert.match(rules, /chunks <= 10/)
  assert.match(rules, /data\.size\(\) <= 700000/)
  assert.match(rules, /size <= 5242880/)
})
