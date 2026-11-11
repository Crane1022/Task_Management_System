import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRich, inlineParts, toggleBold, toggleList, continueList, plainText } from '../src/utils/richText.js'

test('bold words, with links still found inside and outside bold', () => {
  const p = inlineParts('Call **Ali now** at https://example.com')
  assert.deepEqual(p.filter((x) => x.bold).map((x) => x.text), ['Ali now'])
  assert.ok(p.some((x) => x.href === 'https://example.com/'))
  assert.deepEqual(inlineParts('a ** b').map((x) => x.text).join(''), 'a ** b') // a lone ** stays as typed
})

test('lines become bullets, numbered points, text and blanks', () => {
  const lines = parseRich('Check:\n- aircond\n* **filter**\n• drain\n  - pipe\n1. call owner\n2) quote\n\nDone')
  assert.deepEqual(lines.map((l) => l.kind), ['text', 'bullet', 'bullet', 'bullet', 'bullet', 'number', 'number', 'blank', 'text'])
  assert.equal(lines[4].indent, 1)
  assert.equal(lines[6].marker, '2.')
  assert.equal(lines[2].parts[0].bold, true)
  assert.equal(plainText('a **b** c'), 'a b c')
})

test('the B button bolds and un-bolds the selection', () => {
  let r = toggleBold('fix the door', 4, 7)
  assert.equal(r.value, 'fix **the** door')
  assert.equal(r.value.slice(r.start, r.end), 'the')
  r = toggleBold(r.value, r.start, r.end)
  assert.equal(r.value, 'fix the door')
  r = toggleBold('ab', 1, 1) // nothing selected: **** with the cursor inside
  assert.equal(r.value, 'a****b')
  assert.equal(r.start, 3)
})

test('the list buttons turn lines into points and back', () => {
  let r = toggleList('one\ntwo\nthree', 0, 7, 'bullet') // the first two lines
  assert.equal(r.value, '- one\n- two\nthree')
  r = toggleList(r.value, 0, 11, 'bullet')
  assert.equal(r.value, 'one\ntwo\nthree')
  r = toggleList('a\nb', 0, 3, 'number')
  assert.equal(r.value, '1. a\n2. b')
})

test('Enter continues a list, and ends it on an empty point', () => {
  let r = continueList('- one', 5)
  assert.equal(r.value, '- one\n- ')
  r = continueList('1. one', 6)
  assert.equal(r.value, '1. one\n2. ')
  r = continueList('- one\n- ', 8)
  assert.equal(r.value, '- one\n')
  assert.equal(continueList('plain', 5), null)
})
