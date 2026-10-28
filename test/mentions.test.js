import test from 'node:test'
import assert from 'node:assert/strict'
import { activeQuery, insertMention, resolveMentions, splitMentions } from '../src/utils/mentions.js'

test('activeQuery finds the @name being typed', () => {
  assert.deepEqual(activeQuery('hello @Al'), { query: 'Al', start: 6 })
  assert.deepEqual(activeQuery('@'), { query: '', start: 0 })
  assert.equal(activeQuery('mail me at a@b.com'), null, 'an e-mail address is not a tag')
  assert.equal(activeQuery('hello @Al and more'), null, 'a space ends the tag')
  assert.deepEqual(activeQuery('hi @Al there', 6), { query: 'Al', start: 3 }, 'uses the caret position')
})

test('insertMention swaps the query for the full name', () => {
  const r = insertMention('hi @Al', 6, 'Alice Tan')
  assert.equal(r.text, 'hi @Alice Tan ')
  assert.equal(r.caret, 14)
  const mid = insertMention('hi @Al there', 6, 'Alice')
  assert.equal(mid.text, 'hi @Alice  there')
})

test('resolveMentions keeps only names still in the text, once each', () => {
  const picked = [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }, { id: 'a', name: 'Alice' }]
  assert.deepEqual(resolveMentions('hey @Alice please look', picked), ['a'])
  assert.deepEqual(resolveMentions('nobody', picked), [])
  const many = Array.from({ length: 15 }, (_, i) => ({ id: `u${i}`, name: `N${i}` }))
  assert.equal(resolveMentions(many.map((p) => `@${p.name}`).join(' '), many).length, 10, 'capped at 10')
})

test('splitMentions marks the mention parts, longest name first', () => {
  assert.deepEqual(splitMentions('hi @Ann Lee ok', ['Ann', 'Ann Lee']), [
    { text: 'hi ', mention: false }, { text: '@Ann Lee', mention: true }, { text: ' ok', mention: false },
  ])
  assert.deepEqual(splitMentions('plain', []), [{ text: 'plain', mention: false }])
  assert.deepEqual(splitMentions('a (x) @C++', ['C++']), [{ text: 'a (x) ', mention: false }, { text: '@C++', mention: true }], 'regex characters in a name are safe')
})
