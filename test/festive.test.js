import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dateSource, normalizeEvent, normalizeSettings, activeOn, nextStart, daysUntil, needsDate, popupKey, visibleTo, todaysFestival, ramadanToday,
  isBirthday, timeOfDay, weekday, isRainCode, isRaining, weatherText, mood, iftarLeft, formatLeft, fill, presetOf, PRESETS, OUTFIT_IDS, DECORATION_IDS, ymd,
} from '../src/companions/festive.js'
import { accessorySvg, ACCESSORY_IDS, FESTIVE_ACCESSORY_IDS, fitsWith } from '../src/companions/accessories.js'
import { composePetSvg } from '../src/companions/compose.js'
import { normalizeSettings as normalizeCompanion } from '../src/companions/settings.js'

const d = (y, m, day, h = 12, min = 0) => new Date(y, m - 1, day, h, min)
const ev = (o) => ({ id: o.id ?? 'e1', ...normalizeEvent(o) })

test('a yearly event shows on its day, for as many days as set, and comes back next year', () => {
  const xmas = ev({ name: 'Christmas', month: 12, day: 25, days: 2 })
  assert.equal(activeOn(xmas, d(2026, 12, 24)), false)
  assert.equal(activeOn(xmas, d(2026, 12, 25)), true)
  assert.equal(activeOn(xmas, d(2026, 12, 26)), true)
  assert.equal(activeOn(xmas, d(2026, 12, 27)), false)
  assert.equal(ymd(nextStart(xmas, d(2026, 12, 27))), '2027-12-25')
  assert.equal(daysUntil(xmas, d(2026, 11, 25)), 30)
})

test('an event that runs over New Year is still showing on 1 January', () => {
  const e = ev({ month: 12, day: 31, days: 2 })
  assert.equal(activeOn(e, d(2027, 1, 1)), true)
})

test('lunar and Islamic festivals use the dates the Director sets, and ask for one when none is set', () => {
  const raya = ev({ preset: 'raya', dateType: 'dates', dates: ['2027-03-10', 'bad', '2026-03-20'], days: 2 })
  assert.deepEqual(raya.dates, ['2026-03-20', '2027-03-10'])
  assert.equal(activeOn(raya, d(2027, 3, 11)), true)
  assert.equal(needsDate(raya, d(2026, 11, 25)), false)
  assert.equal(needsDate(ev({ dateType: 'dates', dates: [] }), d(2026, 11, 25)), true)
})

test('moving festivals find next year\u2019s date on their own; a typed official date wins', () => {
  const cny = ev({ preset: 'cny', dateType: 'auto' })
  assert.equal(ymd(nextStart(cny, d(2026, 11, 25))), '2027-02-07')
  assert.equal(dateSource(cny, d(2026, 11, 25)), 'auto')
  const raya = ev({ preset: 'raya', dateType: 'auto', days: 2 })
  assert.equal(activeOn(raya, d(2026, 3, 22)), true)
  assert.equal(needsDate(raya, d(2026, 11, 25)), false)
  const typed = ev({ preset: 'raya', dateType: 'auto', dates: ['2027-03-11'] }) // JAKIM announces a day later
  assert.equal(ymd(nextStart(typed, d(2026, 11, 25))), '2027-03-11')
  assert.equal(dateSource(typed, d(2026, 11, 25)), 'typed')
  // saved by the first version with no date: now worked out
  assert.equal(normalizeEvent({ preset: 'deepavali', dateType: 'dates', dates: [] }).dateType, 'auto')
  // a custom event can't be "auto"
  assert.equal(normalizeEvent({ preset: 'custom', dateType: 'auto' }).dateType, 'yearly')
})

test('a festival that has passed rolls on to next year', () => {
  const hw = ev({ month: 10, day: 31 })
  assert.equal(ymd(nextStart(hw, d(2026, 11, 25))), '2027-10-31')
  const dv = ev({ preset: 'deepavali', dateType: 'auto' })
  assert.equal(ymd(nextStart(dv, d(2026, 11, 25))), '2027-10-28')
})

test('a switched-off event never shows', () => {
  assert.equal(activeOn(ev({ month: 12, day: 25, enabled: false }), d(2026, 12, 25)), false)
})

test('the pop-up comes the day before (or the days set), once per festival date', () => {
  const xmas = ev({ id: 'x', month: 12, day: 25, popupDaysBefore: 1 })
  assert.equal(popupKey(xmas, d(2026, 12, 24)), 'x:2026-12-25')
  assert.equal(popupKey(xmas, d(2026, 12, 23)), '')
  assert.equal(popupKey(xmas, d(2026, 12, 25)), '') // not on the day itself
  assert.equal(popupKey(ev({ id: 'x', month: 12, day: 25, popupDaysBefore: 3 }), d(2026, 12, 22)), 'x:2026-12-25')
  assert.equal(popupKey(ev({ month: 12, day: 25, popupDaysBefore: 0 }), d(2026, 12, 24)), '')
})

test('everyone sees an event for all; a "selected" event only reaches the people picked', () => {
  const all = ev({ audience: 'all', audienceIds: ['ignored'] })
  assert.deepEqual(all.audienceIds, [])
  assert.equal(visibleTo(all, 'anyone'), true)
  const sel = ev({ audience: 'selected', audienceIds: ['crane', 'ivan', 'crane'] })
  assert.deepEqual(sel.audienceIds, ['crane', 'ivan'])
  assert.equal(visibleTo(sel, 'crane'), true)
  assert.equal(visibleTo(sel, 'aisyah'), false)
})

test('events are cleaned before they are saved: unknown outfits, decorations and odd values are dropped', () => {
  const e = normalizeEvent({ name: ' '.repeat(3), outfit: 'jetpack', decorations: ['snow', 'lava'], days: 999, popupDaysBefore: -4, color: 'red', month: 13 })
  assert.equal(e.name, 'Special day')
  assert.equal(e.outfit, '')
  assert.deepEqual(e.decorations, ['snow'])
  assert.equal(e.days, 40)
  assert.equal(e.popupDaysBefore, 0)
  assert.equal(e.color, '#4a7c59')
  assert.equal(e.month, 12)
})

test('the standard set covers the Malaysian festivals, with no guessed dates for moving ones', () => {
  for (const id of ['christmas', 'cny', 'raya', 'hajj', 'deepavali', 'thaipusam', 'wesak', 'merdeka', 'malaysiaday', 'gawai', 'kaamatan', 'ramadan']) assert.ok(presetOf(id), id)
  for (const id of ['cny', 'raya', 'hajj', 'deepavali', 'thaipusam', 'wesak', 'ramadan']) { assert.deepEqual(presetOf(id).dates, [], id); assert.equal(presetOf(id).dateType, 'auto', id) }
  for (const p of PRESETS) {
    const n = normalizeEvent(p)
    if (p.outfit) assert.ok(OUTFIT_IDS.includes(n.outfit), p.preset)
    assert.equal(n.decorations.length, p.decorations.length, p.preset)
  }
})

test('today’s festival skips Ramadan; Ramadan is found on its own', () => {
  const list = [ev({ id: 'r', preset: 'ramadan', dateType: 'dates', dates: ['2027-02-08'], days: 30 }), ev({ id: 'v', month: 2, day: 14 })]
  assert.equal(todaysFestival(list, d(2027, 2, 14)).id, 'v')
  assert.equal(ramadanToday(list, d(2027, 2, 14)).id, 'r')
  assert.equal(ramadanToday(list, d(2027, 3, 20)), null)
})

test('birthday, time of day, Monday and Friday, rain', () => {
  assert.equal(isBirthday('11-25', d(2026, 11, 25)), true)
  assert.equal(isBirthday('', d(2026, 11, 25)), false)
  assert.equal(timeOfDay(d(2026, 11, 25, 8)), 'morning')
  assert.equal(timeOfDay(d(2026, 11, 25, 14)), '')
  assert.equal(timeOfDay(d(2026, 11, 25, 21, 5)), 'night')
  assert.equal(weekday(d(2026, 11, 23)), 'monday')
  assert.equal(weekday(d(2026, 11, 27)), 'friday')
  assert.equal(isRainCode(63), true)
  assert.equal(isRainCode(2), false)
  assert.equal(isRainCode(51), false) // drizzle is not rain on its own
})

test('everyday extras are added on top; a festival outfit only stands in for the wardrobe outfit', () => {
  const xmas = ev({ month: 12, day: 25, outfit: 'santa', decorations: ['snow'], greetings: ['Merry Christmas!'] })
  assert.equal(mood({ festival: xmas, rain: true, tod: 'night' }).outfit, 'santa')
  assert.equal(mood({ festival: xmas, rain: true }).extra, 'umbrella')   // Santa hat AND umbrella
  assert.deepEqual(mood({ festival: xmas, rain: 'storm' }).decorations, ['snow', 'rain', 'lightning'])
  assert.equal(mood({ rain: true, tod: 'night' }).outfit, '')            // the wardrobe outfit stays
  assert.equal(mood({ rain: true, tod: 'night' }).extra, 'umbrella')
  assert.deepEqual(mood({ rain: true }).decorations, ['rain'])
  assert.equal(mood({ rain: 'storm' }).source, 'storm')
  assert.equal(mood({ tod: 'night', day: 'friday' }).extra, 'nightcap')
  assert.equal(mood({ day: 'friday' }).extra, 'shades')
  assert.equal(mood({}).source, '')
  const ram = ev({ preset: 'ramadan', greetings: ['Fasting with you!'] })
  assert.equal(mood({ ramadan: ram }).source, 'ramadan')
  assert.equal(mood({ ramadan: ram, iftarSoon: true }).source, 'iftar')
})

test('buka puasa countdown runs from 3 pm until maghrib', () => {
  assert.equal(iftarLeft('19:20', d(2027, 2, 20, 14)), null)
  assert.equal(iftarLeft('19:20', d(2027, 2, 20, 18, 38)), 42 * 60000)
  assert.equal(iftarLeft('19:20', d(2027, 2, 20, 19, 30)), null)
  assert.equal(iftarLeft('soon', d(2027, 2, 20, 18)), null)
  assert.equal(formatLeft(42 * 60000 + 18000), '00:42:18')
})

test('{name} and {pet} are filled in', () => {
  assert.equal(fill('Hi {name}, {pet} says hello', { name: 'Crane', pet: 'Mochi' }), 'Hi Crane, Mochi says hello')
  assert.equal(fill('{pet} waves'), 'Your pet waves')
})

test('every festive outfit is drawn, and kept in its own place in the companion settings', () => {
  const anchors = { top: [50, 14], head: [50, 40], neck: [50, 64], w: 52 }
  for (const id of FESTIVE_ACCESSORY_IDS) {
    assert.ok(accessorySvg(id, anchors).includes('pet-acc'), id)
    assert.equal(normalizeCompanion({ accessory: 'crown', outfit: id }).outfit, id)
    assert.equal(normalizeCompanion({ accessory: 'crown', outfit: id }).accessory, 'crown') // never replaced
  }
  for (const id of OUTFIT_IDS) assert.ok(FESTIVE_ACCESSORY_IDS.includes(id) || ACCESSORY_IDS.includes(id), id)
  assert.equal(normalizeCompanion({ outfit: 'jetpack' }).outfit, '')
  assert.equal(normalizeCompanion({}).outfit, '')
})

test('a festive outfit saved as the accessory by the first version moves to the outfit place', () => {
  const s = normalizeCompanion({ accessory: 'santa' })
  assert.equal(s.accessory, 'none')
  assert.equal(s.outfit, 'santa')
})

test('accessory and outfit are worn together unless they sit in the same place', () => {
  assert.equal(fitsWith('crown', 'garland'), true)   // hat + neck
  assert.equal(fitsWith('glasses', 'santa'), true)   // eyes + hat
  assert.equal(fitsWith('scarf', 'umbrella'), true)
  assert.equal(fitsWith('crown', 'santa'), false)    // two hats: the festive one shows for now
  assert.equal(fitsWith('glasses', 'shades'), false)
  assert.equal(fitsWith('headphones', 'nightcap'), false)
  assert.equal(fitsWith('crown', 'ghost'), true)     // the little ghost keeps its crown
  assert.equal(fitsWith('glasses', 'ghost'), false)
  assert.equal(fitsWith('none', 'santa'), true)
  assert.equal(fitsWith('crown', ''), true)
})

test('the drawn pet has both the accessory and the outfit', async () => {
  const art = { under: '<g id="body"/>', head: '<g id="head"/>', front: '', anchors: { top: [50, 14], head: [50, 40], neck: [50, 64], w: 52 } }
  const both = composePetSvg({ art, accessory: 'crown', outfit: 'garland' })
  assert.ok(both.includes('#ffd23f'), 'crown drawn')
  assert.ok(both.includes('#f08a24'), 'garland drawn')
  assert.ok(both.indexOf('#f08a24') < both.indexOf('pet-head'), 'garland under the head')
  const clash = composePetSvg({ art, accessory: 'crown', outfit: 'santa' })
  assert.ok(!clash.includes('#ffd23f') && clash.includes('#d23b2f'), 'only the Santa hat while it is worn')
  assert.ok(composePetSvg({ art, accessory: 'crown' }).includes('#ffd23f'), 'the crown is back without the outfit')
})

test('rain only counts when it is really raining', () => {
  assert.equal(isRaining({ code: 51, mm: 0 }), false)  // "drizzle" with nothing measured: dry
  assert.equal(isRaining({ code: 53, mm: 0.3 }), true) // drizzle that is measured
  assert.equal(isRaining({ code: 3, mm: 0.2 }), true)  // cloudy, but 0.2 mm fell
  assert.equal(isRaining({ code: 61, mm: 0 }), false)  // light rain with nothing measured
  assert.equal(isRaining({ code: 63, mm: 0 }), true)   // rain
  assert.equal(isRaining({ code: 95, mm: 0 }), true)   // thunderstorm
  assert.equal(isRaining({ code: 2, mm: 0 }), false)
  assert.equal(isRaining({ code: null, mm: 0 }), false)
  assert.equal(weatherText(81), 'Showers')
})

test('company settings keep only known, sensible values', () => {
  const s = normalizeSettings({ enabled: false, prayerZone: 'hack', maghribFallback: 'later', lat: 'x', place: 'Penang' })
  assert.equal(s.enabled, false)
  assert.equal(s.prayerZone, 'WLY01')
  assert.equal(s.maghribFallback, '19:15')
  assert.equal(s.place, 'Penang')
  assert.equal(typeof s.lat, 'number')
  assert.ok(DECORATION_IDS.includes('snow'))
})
