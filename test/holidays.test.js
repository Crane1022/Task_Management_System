import test from 'node:test'
import assert from 'node:assert/strict'
import { autoStarts, isAuto } from '../src/companions/holidays.js'

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const got = (p, y) => autoStarts(p, y).map(ymd)

// Malaysia's public holidays (official dates)
const OFFICIAL = {
  cny: { 2022: '2022-02-01', 2023: '2023-01-22', 2024: '2024-02-10', 2025: '2025-01-29', 2026: '2026-02-17' },
  // 2026 from the gazetted list as well
  raya: { 2022: '2022-05-02', 2023: '2023-04-22', 2024: '2024-04-10', 2025: '2025-03-31', 2026: '2026-03-21' },
  hajj: { 2022: '2022-07-10', 2023: '2023-06-29', 2024: '2024-06-17', 2025: '2025-06-07', 2026: '2026-05-27' },
  ramadan: { 2022: '2022-04-03', 2023: '2023-03-23', 2024: '2024-03-12', 2025: '2025-03-02', 2026: '2026-02-19' },
  deepavali: { 2021: '2021-11-04', 2022: '2022-10-24', 2023: '2023-11-12', 2024: '2024-10-31', 2025: '2025-10-20', 2026: '2026-11-08' },
}
for (const [preset, years] of Object.entries(OFFICIAL)) {
  test(`${preset} is worked out to the official Malaysian date`, () => {
    for (const [y, want] of Object.entries(years)) assert.ok(got(preset, +y).includes(want), `${preset} ${y}: got ${got(preset, +y)}, want ${want}`)
  })
}

test('Thaipusam and Wesak land within a couple of days of the official date', () => {
  const near = (p, y, want, max) => { const d = autoStarts(p, y)[0]; assert.ok(d && Math.abs(d - new Date(want + 'T00:00')) <= max * 864e5, `${p} ${y}: ${d && ymd(d)} vs ${want}`) }
  for (const [y, w] of [[2021, '2021-01-28'], [2022, '2022-01-18'], [2023, '2023-02-05'], [2024, '2024-01-25'], [2025, '2025-02-11'], [2026, '2026-02-01']]) near('thaipusam', y, w, 1)
  for (const [y, w] of [[2021, '2021-05-26'], [2022, '2022-05-15'], [2023, '2023-05-04'], [2024, '2024-05-22'], [2025, '2025-05-12'], [2026, '2026-05-31']]) near('wesak', y, w, 2)
})

test('every moving festival has a date for the next ten years', () => {
  for (const p of ['cny', 'ramadan', 'raya', 'hajj', 'deepavali', 'thaipusam', 'wesak']) {
    assert.ok(isAuto(p))
    for (let y = 2026; y <= 2036; y++) assert.ok(autoStarts(p, y).length >= 1, `${p} ${y}`)
  }
  assert.equal(isAuto('christmas'), false)
})
