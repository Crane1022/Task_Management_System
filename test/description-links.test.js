import test from 'node:test'
import assert from 'node:assert/strict'
import { splitLinks, linksIn } from '../src/utils/links.js'

test('plain text has no links', () => {
  assert.deepEqual(splitLinks('just words'), [{ text: 'just words', href: null }])
  assert.deepEqual(linksIn(''), [])
})

test('a link in the middle is split out, with the text around it kept', () => {
  assert.deepEqual(splitLinks('see https://example.com/a?b=1 now'), [
    { text: 'see ', href: null }, { text: 'https://example.com/a?b=1', href: 'https://example.com/a?b=1' }, { text: ' now', href: null },
  ])
})

test('sentence punctuation is not part of the link; brackets only if the link opened one', () => {
  assert.equal(splitLinks('go to https://example.com.')[1].text, 'https://example.com')
  assert.equal(splitLinks('(see https://example.com/x)')[1].text, 'https://example.com/x')
  assert.equal(splitLinks('https://en.wikipedia.org/wiki/Foo_(bar) ok')[0].text, 'https://en.wikipedia.org/wiki/Foo_(bar)')
  assert.equal(splitLinks('really? https://example.com/q!')[1].text, 'https://example.com/q')
})

test('www. links work and become https', () => {
  assert.deepEqual(linksIn('open www.widebed.com.my/tasks please'), ['https://www.widebed.com.my/tasks'])
})

test('only safe web links count: javascript:, data: and bare words are ignored', () => {
  assert.deepEqual(linksIn('javascript:alert(1) data:text/html,hi ftp://x.com localhost'), [])
  assert.deepEqual(linksIn('https://nodot'), [], 'a host with no dot is not offered')
})

test('linksIn lists each link once, in order, even from Google Drive', () => {
  const t = 'a https://drive.google.com/file/d/1AbC/view b https://example.com c https://drive.google.com/file/d/1AbC/view'
  assert.deepEqual(linksIn(t), ['https://drive.google.com/file/d/1AbC/view', 'https://example.com/'])
})
