import test from 'node:test'
import assert from 'node:assert/strict'
import { toPixels, toShare, dragTo, isDrag, fitSize, clamp, MARGIN, DRAG_THRESHOLD } from '../src/companions/position.js'
import { DEFAULT_POSITION, SIZE } from '../src/companions/settings.js'

const inside = (p, size, vw, vh) => p.left >= MARGIN && p.top >= MARGIN && p.left + size <= vw - MARGIN && p.top + size <= vh - MARGIN

test('the pet always stays fully inside the window, wherever it was saved', () => {
  for (const pos of [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0.5, y: 0.5 }, { x: 0.99, y: 0.01 }]) {
    assert.ok(inside(toPixels(pos, 96, 1366, 768), 96, 1366, 768), JSON.stringify(pos))
  }
})

test('dragging is limited to the window', () => {
  const start = { left: 100, top: 100 }
  const p = dragTo(start, 5000, -5000, 96, 1000, 700)
  assert.equal(p.left, 1000 - 96 - MARGIN)
  assert.equal(p.top, MARGIN)
  assert.deepEqual(dragTo(start, 30, 20, 96, 1000, 700), { left: 130, top: 120 })
})

test('a drop is remembered: the saved position gives the same place back', () => {
  const dropped = dragTo({ left: 300, top: 200 }, 120, 80, 96, 1366, 768)
  const saved = toShare(dropped.left, dropped.top, 96, 1366, 768)
  assert.ok(saved.x > 0 && saved.x < 1 && saved.y > 0 && saved.y < 1)
  const again = toPixels(saved, 96, 1366, 768)
  assert.ok(Math.abs(again.left - dropped.left) < 0.001 && Math.abs(again.top - dropped.top) < 0.001)
})

test('after the window is resized the pet is recalculated and never lost off-screen', () => {
  const saved = { x: 0.9, y: 0.8 }
  const big = toPixels(saved, 96, 1920, 1080)
  const small = toPixels(saved, 96, 400, 600)
  assert.ok(inside(big, 96, 1920, 1080))
  assert.ok(inside(small, 96, 400, 600))
  // a tiny window, smaller than the pet plus margins, still returns something sane
  assert.ok(Number.isFinite(toPixels(saved, 96, 90, 90).left))
  // growing back restores the original place (the saved share was never changed)
  assert.deepEqual(toPixels(saved, 96, 1920, 1080), big)
})

test('the starting place is inside a laptop, a tablet and a phone screen', () => {
  for (const [w, h] of [[1366, 768], [1024, 768], [390, 844]]) {
    const size = fitSize(SIZE.def, w, h)
    assert.ok(inside(toPixels(DEFAULT_POSITION, size, w, h), size, w, h), `${w}x${h}`)
  }
})

test('a large pet is shrunk on a small screen', () => {
  assert.ok(fitSize(200, 390, 844) <= 390 * 0.4)
  assert.equal(fitSize(96, 1920, 1080), 96)
  assert.ok(fitSize(200, 100, 100) >= 48)
})

test('a small movement is a pat, a bigger one is a drag', () => {
  assert.equal(isDrag(0, 0), false)
  assert.equal(isDrag(DRAG_THRESHOLD, 0), false)
  assert.equal(isDrag(DRAG_THRESHOLD + 1, 0), true)
  assert.equal(isDrag(4, 4), true)
  assert.equal(clamp(5, 10, 20), 10)
})
