import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTree, treeToLayout, normalizeTree, cleanFolderName, MAX_FOLDER_NAME } from '../src/utils/sidebarLayout.js'

const W = (id, name = id) => ({ id, name })
const wss = [W('a'), W('b'), W('c'), W('d')]
const shape = (tree) => tree.map((e) => (e.kind === 'ws' ? e.ws.id : `[${e.name}: ${e.items.map((w) => w.id).join(',')}]`))

test('with no saved layout every workspace is listed in its own order', () => {
  assert.deepEqual(shape(buildTree(wss, null)), ['a', 'b', 'c', 'd'])
})
test('a saved order and folders are followed', () => {
  const layout = { order: ['f:x', 'w:d', 'w:a'], folders: { x: { name: 'Ops', wsIds: ['c', 'b'] } } }
  assert.deepEqual(shape(buildTree(wss, layout)), ['[Ops: c,b]', 'd', 'a'])
})
test('a workspace that is gone is dropped, a new one is added at the end, and none is shown twice', () => {
  const layout = { order: ['w:a', 'w:gone', 'f:x', 'w:b'], folders: { x: { name: 'X', wsIds: ['b', 'gone', 'b'] } } }
  assert.deepEqual(shape(buildTree(wss, layout)), ['a', '[X: b]', 'c', 'd'])
})
test('a folder that is missing from the order is still shown, and bad data does not break anything', () => {
  assert.deepEqual(shape(buildTree(wss, { order: 'nope', folders: { y: { name: '', wsIds: 'nope' } } })), ['[Folder: ]', 'a', 'b', 'c', 'd'])
  assert.deepEqual(shape(buildTree([], { order: ['w:a'], folders: null })), [])
})
test('what is drawn can be saved and drawn again unchanged', () => {
  const layout = { order: ['w:b', 'f:x', 'w:a'], folders: { x: { name: 'Team', wsIds: ['d', 'c'] } } }
  const tree = buildTree(wss, layout)
  const saved = treeToLayout(tree)
  assert.deepEqual(saved, layout)
  assert.deepEqual(shape(buildTree(wss, saved)), shape(tree))
})
test('folder names are tidied and kept short', () => {
  assert.equal(cleanFolderName('  Sales   team  '), 'Sales team')
  assert.equal(cleanFolderName('x'.repeat(100)).length, MAX_FOLDER_NAME)
  assert.equal(cleanFolderName(null), '')
})

test('a workspace dragged into a folder (still wrapped) or out of one (bare) is saved correctly, with no undefined ids', () => {
  const dragged = [
    { kind: 'ws', key: 'w:b', ws: W('b') }, // came out of the main list into the folder's list
    { kind: 'folder', id: 'x', key: 'f:x', name: 'Ops', items: [W('a'), { kind: 'ws', key: 'w:c', ws: W('c') }] },
    W('d'),                                  // came out of a folder into the main list
  ]
  const tree = normalizeTree([dragged[1], dragged[0], dragged[2]])
  assert.deepEqual(shape(tree), ['[Ops: a,c]', 'b', 'd'])
  const saved = treeToLayout(tree)
  assert.deepEqual(saved, { order: ['f:x', 'w:b', 'w:d'], folders: { x: { name: 'Ops', wsIds: ['a', 'c'] } } })
  assert.ok(!JSON.stringify(saved).includes('null') && saved.folders.x.wsIds.every((id) => typeof id === 'string'))
})
test('a workspace that ends up twice, or without an id, is kept once or dropped', () => {
  const tree = normalizeTree([W('a'), { kind: 'folder', id: 'x', name: 'X', items: [W('a'), {}, null] }, {}, null])
  assert.deepEqual(shape(tree), ['a', '[X: ]'])
})
