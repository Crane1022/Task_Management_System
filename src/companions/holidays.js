// Works out the date of festivals that move every year (25 Nov 2026), so a Director doesn't have to type them in.
// Checked against Malaysia's public holidays 2021–2025 (test/holidays.test.js):
//   Chinese New Year      Chinese calendar, 1st day of the 1st month                     exact
//   Ramadan, Hari Raya,   Islamic calendar + 1 day (Malaysia sees the moon a day after   exact for 2022–2025
//   Hari Raya Haji        the astronomical calendar); JAKIM can still announce otherwise
//   Deepavali             the day before the new moon between 16 Oct and 15 Nov           exact for 2021–2025
//   Thaipusam             the day before the full moon between 15 Jan and 14 Feb          usually right, can be 1 day off
//   Wesak                 the day before the full moon between 3 May and 2 June           can be 1–2 days off
// A date the Director types in for that year always wins over these.

export const AUTO = {
  cny: { how: 'Chinese calendar', sure: true },
  ramadan: { how: 'Islamic calendar', sure: true },
  raya: { how: 'Islamic calendar', sure: true },
  hajj: { how: 'Islamic calendar', sure: true },
  deepavali: { how: 'new moon', sure: true },
  thaipusam: { how: 'full moon', sure: false },
  wesak: { how: 'full moon', sure: false },
}
export const isAuto = (preset) => !!AUTO[preset]

const DAY = 864e5
const local = (utcMs) => { const d = new Date(utcMs); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }

// ----- calendars built into the browser -----
const formatters = {}
function calendarDay(cal, utcMs) {
  if (!formatters[cal]) {
    const f = new Intl.DateTimeFormat('en-u-ca-' + cal, { timeZone: 'UTC', month: 'numeric', day: 'numeric' })
    formatters[cal] = f.resolvedOptions().calendar === cal ? f : null // this browser doesn't know the calendar
  }
  const f = formatters[cal]
  if (!f) return null
  const p = {}
  for (const x of f.formatToParts(new Date(utcMs))) p[x.type] = x.value
  return { month: p.month, day: +p.day }
}
// every day in [from, to) (UTC ms) that is month/day in the calendar
function findDays(cal, month, day, from, to) {
  const out = []
  for (let t = from; t < to; t += DAY) {
    const c = calendarDay(cal, t)
    if (!c) return null
    if (c.month === String(month) && c.day === day) out.push(t)
  }
  return out
}
const islamic = (year, month, day) => {
  const hits = findDays('islamic', month, day, Date.UTC(year, 0, 1) - DAY, Date.UTC(year + 1, 0, 1) - DAY)
  return hits ? hits.map((t) => local(t + DAY)) : null // + 1 day for Malaysia
}

// ----- moon (Meeus, "Astronomical Algorithms" ch. 49; good to a few minutes) -----
function phaseUtcMs(k) {
  const T = k / 1236.85, r = Math.PI / 180
  const jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4
  const E = 1 - 0.002516 * T - 0.0000074 * T * T
  const M = (2.5534 + 29.1053567 * k - 0.0000014 * T * T) * r
  const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T * T) * r
  const F = (160.7108 + 390.67050284 * k - 0.0016118 * T * T) * r
  const O = (124.7746 - 1.56375588 * k + 0.0020672 * T * T) * r
  const full = Math.abs(k % 1) > 0.25
  const a = full ? [-0.40614, 0.17302] : [-0.4072, 0.17241]
  const fix = a[0] * Math.sin(Mp) + a[1] * E * Math.sin(M) + (full ? 0.01614 : 0.01608) * Math.sin(2 * Mp) + (full ? 0.01043 : 0.01039) * Math.sin(2 * F)
    + (full ? 0.00734 : 0.00739) * E * Math.sin(Mp - M) - (full ? 0.00515 : 0.00514) * E * Math.sin(Mp + M) + (full ? 0.00209 : 0.00208) * E * E * Math.sin(2 * M)
    - 0.00111 * Math.sin(Mp - 2 * F) - 0.00057 * Math.sin(Mp + 2 * F) + 0.00056 * E * Math.sin(2 * Mp + M) - 0.00042 * Math.sin(3 * Mp)
    + 0.00042 * E * Math.sin(M + 2 * F) + 0.00038 * E * Math.sin(M - 2 * F) - 0.00024 * E * Math.sin(2 * Mp - M) - 0.00017 * Math.sin(O)
  return (jde + fix - 2440587.5) * DAY - 69e3
}
// the Malaysia-time day (00:00 UTC of that day, in ms) of each new (phase 0) or full (0.5) moon in [from, to)
function moonDays(phase, from, to) {
  const k0 = Math.floor((new Date(from).getUTCFullYear() + new Date(from).getUTCMonth() / 12 - 2000) * 12.3685) - 2
  const out = []
  for (let k = k0; k < k0 + 6; k++) {
    const t = phaseUtcMs(k + phase) + 8 * 3600e3 // Malaysia time
    const dayStart = Math.floor(t / DAY) * DAY
    if (dayStart >= from && dayStart < to) out.push(dayStart)
  }
  return out
}
const dayBeforeMoon = (phase, year, [m1, d1], [m2, d2]) => moonDays(phase, Date.UTC(year, m1 - 1, d1), Date.UTC(year, m2 - 1, d2) + DAY).slice(0, 1).map((t) => local(t - DAY))

// ----- the start days of a festival in a year (cached) -----
const cache = new Map()
export function autoStarts(preset, year) {
  const key = preset + year
  if (cache.has(key)) return cache.get(key)
  let out = []
  try {
    switch (preset) {
      case 'cny': out = (findDays('chinese', 1, 1, Date.UTC(year, 0, 15), Date.UTC(year, 1, 25)) ?? []).map(local); break
      case 'ramadan': out = islamic(year, 9, 1) ?? []; break
      case 'raya': out = islamic(year, 10, 1) ?? []; break
      case 'hajj': out = islamic(year, 12, 10) ?? []; break
      case 'deepavali': out = dayBeforeMoon(0, year, [10, 16], [11, 15]); break
      case 'thaipusam': out = dayBeforeMoon(0.5, year, [1, 15], [2, 14]); break
      case 'wesak': out = dayBeforeMoon(0.5, year, [5, 3], [6, 2]); break // 2026 has two May full moons: Wesak is the second
    }
  } catch { out = [] }
  cache.set(key, out)
  return out
}
