import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveTheme, PRESETS, dashboardLayer, readableOn, mix } from '../src/utils/themes.js'

// hue in degrees and saturation 0..1 of a #rrggbb colour
function hsl(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (!d) return { h: 0, s: 0 }
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  const l = (max + min) / 2
  return { h: (h * 60 + 360) % 360, s: d / (1 - Math.abs(2 * l - 1)) }
}
const yellowish = (hex) => { const { h, s } = hsl(hex); return h >= 30 && h <= 65 && s > 0.2 }

test('the default theme is Light, and it is not yellow any more', () => {
  const t = resolveTheme([])
  assert.equal(t.mode, 'light')
  for (const key of ['background', 'surface', 'border', 'primary', 'accent']) assert.equal(yellowish(t.colors[key]), false, `${key} ${t.colors[key]} looks yellow`)
  assert.equal(t.colors.surface, '#ffffff')
})
test('Dark mode and Moss are not yellow either (Sand stays warm on purpose)', () => {
  for (const id of ['dark', 'moss']) for (const [k, v] of Object.entries(PRESETS[id].c)) assert.equal(yellowish(v), false, `${id}.${k}`)
})
test('precedence: page beats dashboard beats global', () => {
  const t = resolveTheme([{ preset: 'sky', fontSize: 110 }, { preset: 'clay' }, { preset: 'dusk', radius: 0.5 }])
  assert.equal(t.mode, 'dark')               // page layer (dusk) wins
  assert.equal(t.colors.primary, PRESETS.dusk.c.primary)
  assert.equal(t.fontScale, 110)             // only the global layer set a size, so it is kept
  assert.equal(t.radius, 0.5)
})
test('a page with no look of its own falls back to the dashboard, then the global look', () => {
  assert.equal(resolveTheme([{ preset: 'sky' }, null, null]).colors.primary, PRESETS.sky.c.primary)
  assert.equal(resolveTheme([{ preset: 'sky' }, { preset: 'clay' }, null]).colors.primary, PRESETS.clay.c.primary)
})
test('custom colours override the preset, and bad values are ignored', () => {
  const t = resolveTheme([{ preset: 'light', colors: { primary: '#112233', accent: 'red', surface: 'javascript:1' } }])
  assert.equal(t.colors.primary, '#112233')
  assert.equal(t.colors.accent, PRESETS.light.c.accent)
  assert.equal(t.colors.surface, PRESETS.light.c.surface)
  assert.equal(t.vars['--on-primary'], '#ffffff') // readable text on a dark primary
})
test('System follows the device', () => {
  assert.equal(resolveTheme([{ preset: 'system' }], false).mode, 'light')
  assert.equal(resolveTheme([{ preset: 'system' }], true).mode, 'dark')
})
test('dashboards saved before themes existed keep their palette', () => {
  assert.deepEqual(dashboardLayer({ palette: 'clay' }), { legacyPalette: 'clay' })
  assert.equal(resolveTheme([{}, dashboardLayer({ palette: 'clay' })]).colors.primary, '#b0623a')
  assert.deepEqual(dashboardLayer({ palette: 'clay', theme: { preset: 'sky' } }), { preset: 'sky' }) // a saved theme wins
})
test('readable text colour and mixing', () => {
  assert.equal(readableOn('#ffffff'), '#1b1b1b')
  assert.equal(readableOn('#000000'), '#ffffff')
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080')
})
