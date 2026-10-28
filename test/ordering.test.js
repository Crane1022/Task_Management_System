import test from 'node:test'
import assert from 'node:assert/strict'
import { positionBetween, mergeColumnOrder, byPosition, STEP } from '../src/utils/ordering.js'

test('a card dropped between two cards takes the midpoint', () => {
  assert.equal(positionBetween(1000, 2000), 1500)
  assert.equal(positionBetween(1000, 1001), 1000.5)
})
test('a card dropped at the end or the start, or into an empty column', () => {
  assert.equal(positionBetween(3000, null), 3000 + STEP)
  assert.equal(positionBetween(null, 1000), 1000 - STEP)
  assert.equal(positionBetween(null, null), STEP)
  assert.equal(positionBetween(0, null), STEP) // position 0 is a real position, not "missing"
})
test('cards with the same position keep a stable order', () => {
  const list = [{ id: 'b', position: 1 }, { id: 'a', position: 1 }, { id: 'c', position: 0 }]
  assert.deepEqual(list.sort(byPosition).map((x) => x.id), ['c', 'a', 'b'])
})

const cols = [
  { id: 'new' }, { id: 'todo' }, { id: 'old', archived: true }, { id: 'doing' }, { id: 'done' },
]
test('dragging a column reorders the visible ones and archived columns keep their slot', () => {
  // the example from the spec: TODO before NEW, DONE before DOING
  assert.deepEqual(mergeColumnOrder(cols, ['todo', 'new', 'done', 'doing']), ['todo', 'new', 'old', 'done', 'doing'])
})
test('no change, or a stale list, returns null and writes nothing', () => {
  assert.equal(mergeColumnOrder(cols, ['new', 'todo', 'doing', 'done']), null)
  assert.equal(mergeColumnOrder(cols, ['new', 'todo']), null)
  assert.equal(mergeColumnOrder(cols, ['new', 'new', 'doing', 'done']), null)
})
