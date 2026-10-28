import test from 'node:test'
import assert from 'node:assert/strict'
import { dmId, chatTitle, sortChats, groupProblem } from '../src/utils/chats.js'

const names = { a: 'Alice', b: 'Bob', c: 'Cara' }
const nameOf = (id) => names[id] ?? ''

test('a DM has the same id whoever starts it', () => {
  assert.equal(dmId('a', 'b'), dmId('b', 'a'))
  assert.notEqual(dmId('a', 'b'), dmId('a', 'c'))
})

test('chatTitle: group name, or the other person for a DM', () => {
  assert.equal(chatTitle({ type: 'group', name: 'Design' }, 'a', nameOf), 'Design')
  assert.equal(chatTitle({ type: 'dm', memberIds: ['a', 'b'] }, 'a', nameOf), 'Bob')
  assert.equal(chatTitle({ type: 'dm', memberIds: ['b', 'a'] }, 'a', nameOf), 'Bob')
  assert.equal(chatTitle({ type: 'dm', memberIds: ['a', 'zz'] }, 'a', nameOf), 'Direct message', 'unknown person')
})

test('sortChats puts groups first, then DMs, each A-Z', () => {
  const list = [
    { id: '1', type: 'dm', memberIds: ['a', 'c'] }, { id: '2', type: 'group', name: 'Zeta', memberIds: [] },
    { id: '3', type: 'dm', memberIds: ['a', 'b'] }, { id: '4', type: 'group', name: 'Alpha', memberIds: [] },
  ]
  assert.deepEqual(sortChats(list, 'a', nameOf).map((c) => c.id), ['4', '2', '3', '1'])
})

test('groupProblem', () => {
  const ws = ['a', 'b', 'c']
  assert.equal(groupProblem('Team', ['a', 'b'], ws), '')
  assert.match(groupProblem('  ', ['a', 'b'], ws), /name/)
  assert.match(groupProblem('x'.repeat(61), ['a', 'b'], ws), /too long/)
  assert.match(groupProblem('Team', ['a'], ws), /at least one other/)
  assert.match(groupProblem('Team', ['a', 'zz'], ws), /member of this workspace/)
  assert.match(groupProblem('Team', Array.from({ length: 51 }, (_, i) => `u${i}`), ws), /50 people/)
})
