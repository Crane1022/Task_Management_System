// Festive companion (25 Nov 2026): special days, Ramadan, time of day and weather. Pure, so it can be tested.
import { autoStarts, isAuto, AUTO } from './holidays.js'
export { AUTO, isAuto }
//
// A festive event (Firestore festive_events/{id}), set up by a Director on the Festive events page:
//   { preset, name, enabled, color,
//     dateType: 'yearly' (month + day, same every year) | 'auto' (worked out every year: companions/holidays.js)
//               | 'dates' (only the start dates typed in). With 'auto', a date typed in for a year wins for that year.
//     month, day, dates: ['2027-02-06', ...], days (how long it shows, 1..40), popupDaysBefore (0..7),
//     outfit, decorations: [...], greetings: [...], popupTitle, popupMessage,
//     audience: 'all' | 'selected', audienceIds: [uid, ...] }
// Text may use {name} (the person's first name) and {pet} (their pet's name).

// ----- outfits: drawn by companions/accessories.js; free, and kept in each person's wardrobe once seen -----
export const OUTFITS = [
  { id: 'santa', name: 'Santa hat' },
  { id: 'party', name: 'Party hat' },
  { id: 'ghost', name: 'Little ghost' },
  { id: 'partyglasses', name: 'Party glasses' },
  { id: 'heart', name: 'Heart' },
  { id: 'redscarf', name: 'Red scarf and coin' },
  { id: 'songkok', name: 'Songkok' },
  { id: 'bindi', name: 'Bindi' },
  { id: 'garland', name: 'Marigold garland' },
  { id: 'lotus', name: 'Lotus' },
  { id: 'flag', name: 'Jalur Gemilang' },
  { id: 'headband', name: 'Beaded headband' },
  { id: 'siga', name: 'Siga headcloth' },
  { id: 'bowtie', name: 'Bow tie' },
  { id: 'shades', name: 'Sunglasses' },
  { id: 'mug', name: 'Coffee mug' },
  { id: 'nightcap', name: 'Nightcap' },
  { id: 'umbrella', name: 'Umbrella' },
]
export const OUTFIT_IDS = OUTFITS.map((o) => o.id)
export const outfitName = (id) => OUTFITS.find((o) => o.id === id)?.name ?? ''

// ----- background decorations (components/FestiveDecor.vue draws them) -----
export const DECORATIONS = [
  { id: 'snow', name: 'Falling snow' }, { id: 'snowman', name: 'Snowman' }, { id: 'tree', name: 'Christmas tree' },
  { id: 'confetti', name: 'Confetti' }, { id: 'fireworks', name: 'Fireworks' }, { id: 'hearts', name: 'Floating hearts' },
  { id: 'pumpkins', name: 'Pumpkins and bats' }, { id: 'lanterns', name: 'Red lanterns' }, { id: 'oranges', name: 'Mandarin oranges' },
  { id: 'ketupat', name: 'Ketupat' }, { id: 'greenlanterns', name: 'Green lanterns' }, { id: 'pelita', name: 'Pelita lamps' },
  { id: 'diyas', name: 'Diya lamps' }, { id: 'stars', name: 'Twinkling stars' }, { id: 'marigolds', name: 'Marigold garland' },
  { id: 'lotus', name: 'Lotus lanterns' }, { id: 'bunting', name: 'Malaysia bunting' }, { id: 'hibiscus', name: 'Bunga raya' },
  { id: 'paddy', name: 'Paddy' }, { id: 'hornbill', name: 'Hornbill' }, { id: 'rain', name: 'Rain' }, { id: 'lightning', name: 'Lightning' },
]
export const DECORATION_IDS = DECORATIONS.map((d) => d.id)

// ----- the standard set a Director can add with one button. Festivals that move every year (lunar, Islamic, Hindu,
// Buddhist calendars) get their date worked out each year; a Director can still type the official one. -----
const P = (id, name, color, date, outfit, decorations, greetings, popupMessage, extra = {}) => ({
  preset: id, name, color, outfit, decorations, greetings, popupTitle: `${name} is tomorrow!`, popupMessage,
  ...(date ? { dateType: 'yearly', month: date[0], day: date[1] } : { dateType: 'auto', dates: [] }),
  days: 1, popupDaysBefore: 1, enabled: true, audience: 'all', audienceIds: [], ...extra,
})
export const PRESETS = [
  P('christmas', 'Christmas', '#c0392b', [12, 25], 'santa', ['snow', 'snowman', 'tree'], ['Merry Christmas! Ho ho ho~', 'Jingle bells, {name}!'], '{pet} has already tried on a Santa hat. Tomorrow your screen gets falling snow and a little snowman.'),
  P('newyear', 'New Year', '#6b5ca5', [1, 1], 'partyglasses', ['fireworks', 'confetti'], ['Happy New Year, {name}! New goals, new tasks!', '3… 2… 1… Happy New Year!'], 'Fireworks and a countdown are ready for tomorrow.'),
  P('cny', 'Chinese New Year', '#d1342a', null, 'redscarf', ['lanterns', 'oranges'], ['Gong Xi Fa Cai! Huat ah!', 'Happy Chinese New Year, {name}!'], 'Red lanterns, mandarin oranges and a red scarf for {pet}.', { days: 2 }),
  P('thaipusam', 'Thaipusam', '#d9822b', null, 'garland', ['marigolds'], ['Wishing you a blessed Thaipusam!'], '{pet} will wear a marigold garland tomorrow.'),
  P('valentine', "Valentine's Day", '#d6456b', [2, 14], 'heart', ['hearts'], ['Sending you lots of love, {name}!'], 'Hearts will float across your screen all day.'),
  P('ramadan', 'Ramadan', '#3d8a4a', null, '', [], ['Fasting with you till buka puasa!', 'Stay strong, {name}. Buka puasa soon!'], 'Ramadan starts tomorrow. {pet} will fast with you and count down to buka puasa every evening.', { days: 30 }),
  P('raya', 'Hari Raya Aidilfitri', '#3d8a4a', null, 'songkok', ['ketupat', 'pelita'], ['Selamat Hari Raya! Maaf zahir dan batin.', 'Selamat Hari Raya, {name}!'], '{pet} is getting ready in a songkok. Ketupat and pelita lamps light up your screen tomorrow.', { days: 2 }),
  P('wesak', 'Wesak Day', '#c9962e', null, 'lotus', ['lotus'], ['Happy Wesak Day! May you be well and happy.'], 'Lotus lanterns will light up your screen tomorrow.'),
  P('kaamatan', 'Pesta Kaamatan', '#8a6a2f', [5, 30], 'siga', ['paddy'], ['Kotobian Tadau Tagazo do Kaamatan!'], '{pet} will wear a siga for the harvest festival.', { days: 2 }),
  P('gawai', 'Gawai Dayak', '#b5452f', [6, 1], 'headband', ['paddy', 'hornbill'], ['Selamat Hari Gawai! Gayu guru, gerai nyamai.'], 'Paddy and a hornbill visit your screen tomorrow.', { days: 2 }),
  P('hajj', 'Hari Raya Haji', '#2f6b4f', null, 'songkok', ['greenlanterns', 'stars'], ['Selamat Hari Raya Aidiladha!'], 'Green lanterns and a crescent moon tomorrow.'),
  P('merdeka', 'Merdeka Day', '#1f3a7a', [8, 31], 'flag', ['bunting'], ['Selamat Hari Merdeka!', 'Merdeka! Happy Independence Day, {name}!'], '{pet} will wave the Jalur Gemilang tomorrow.'),
  P('malaysiaday', 'Malaysia Day', '#cc1f2f', [9, 16], 'flag', ['bunting', 'hibiscus'], ['Selamat Hari Malaysia!'], 'Bunting and bunga raya for Malaysia Day tomorrow.'),
  P('halloween', 'Halloween', '#e8823a', [10, 31], 'ghost', ['pumpkins'], ['Boo! Trick or treat?'], '{pet} is turning into a little ghost tomorrow.'),
  P('deepavali', 'Deepavali', '#c0612b', null, 'bindi', ['diyas', 'stars'], ['Happy Deepavali! Festival of lights.', 'Happy Deepavali, {name}!'], 'Diya lamps will light up your screen tomorrow.'),
]
export const presetOf = (id) => PRESETS.find((p) => p.preset === id)

// The whole-company switches (festive/settings)
export const DEFAULT_SETTINGS = {
  enabled: true, popupBefore: true, wardrobe: true, ramadan: true, timeOfDay: true, weather: true, weekly: true,
  birthdays: true, allowOptOut: true,
  place: 'Kuala Lumpur', lat: 3.139, lon: 101.687, // for the weather
  prayerZone: 'WLY01', maghribFallback: '19:15', // JAKIM zone for buka puasa time; the fallback is used if it can't load
}
export const normalizeSettings = (raw) => {
  const s = { ...DEFAULT_SETTINGS }
  if (!raw || typeof raw !== 'object') return s
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (typeof DEFAULT_SETTINGS[k] === 'boolean' && typeof raw[k] === 'boolean') s[k] = raw[k]
    if (typeof DEFAULT_SETTINGS[k] === 'number' && Number.isFinite(raw[k])) s[k] = raw[k]
    if (typeof DEFAULT_SETTINGS[k] === 'string' && typeof raw[k] === 'string') s[k] = raw[k].slice(0, 60)
  }
  if (!/^[A-Z]{3}\d{2}$/.test(s.prayerZone)) s.prayerZone = DEFAULT_SETTINGS.prayerZone
  if (!/^\d{2}:\d{2}$/.test(s.maghribFallback)) s.maghribFallback = DEFAULT_SETTINGS.maghribFallback
  return s
}

// ----- an event, cleaned before it is saved or used -----
const clampInt = (v, min, max, d) => (Number.isFinite(+v) ? Math.min(max, Math.max(min, Math.round(+v))) : d)
const ISO = /^\d{4}-\d{2}-\d{2}$/
export function normalizeEvent(raw = {}) {
  const preset = typeof raw.preset === 'string' ? raw.preset.slice(0, 30) : 'custom'
  const list = (v, max, len) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, len)).slice(0, max) : [])
  return {
    preset,
    name: String(raw.name ?? '').trim().slice(0, 60) || 'Special day',
    enabled: raw.enabled !== false,
    color: /^#[0-9a-f]{6}$/i.test(raw.color ?? '') ? raw.color : '#4a7c59',
    // a moving festival saved by the first version with no dates is worked out automatically now
    dateType: raw.dateType === 'auto' && isAuto(preset) ? 'auto' : raw.dateType === 'dates' ? (isAuto(preset) && !list(raw.dates, 20, 10).length ? 'auto' : 'dates') : 'yearly',
    month: clampInt(raw.month, 1, 12, 1),
    day: clampInt(raw.day, 1, 31, 1),
    dates: [...new Set(list(raw.dates, 20, 10).filter((d) => ISO.test(d)))].sort(),
    days: clampInt(raw.days, 1, 40, 1),
    popupDaysBefore: clampInt(raw.popupDaysBefore, 0, 7, 1),
    outfit: OUTFIT_IDS.includes(raw.outfit) ? raw.outfit : '',
    decorations: list(raw.decorations, 8, 20).filter((d) => DECORATION_IDS.includes(d)),
    greetings: list(raw.greetings, 10, 120),
    popupTitle: String(raw.popupTitle ?? '').trim().slice(0, 80),
    popupMessage: String(raw.popupMessage ?? '').trim().slice(0, 300),
    audience: raw.audience === 'selected' ? 'selected' : 'all',
    audienceIds: raw.audience === 'selected' ? [...new Set(list(raw.audienceIds, 500, 128))] : [],
  }
}

// ----- dates (local time, whole days) -----
const DAY = 86400000
export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fromIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY)

// the start days of an event in the given year
export function startsIn(ev, year) {
  const typed = (ev.dates ?? []).filter((s) => s.startsWith(year + '-')).map(fromIso)
  if (ev.dateType === 'dates') return typed
  if (ev.dateType === 'auto') return typed.length ? typed : autoStarts(ev.preset, year) // the official date, once typed, wins
  const d = new Date(year, ev.month - 1, ev.day)
  return d.getMonth() === ev.month - 1 ? [d] : [] // 29 Feb only in leap years
}
const startsAround = (ev, today) => [-1, 0, 1].flatMap((k) => startsIn(ev, today.getFullYear() + k))

// is the event showing on this day?
export const activeOn = (ev, today) => !!ev.enabled && startsAround(ev, today).some((s) => { const n = daysBetween(s, today); return n >= 0 && n < (ev.days || 1) })
// the next start from today (today counts), or null
export function nextStart(ev, today) {
  const later = startsAround(ev, today).filter((s) => daysBetween(today, s) >= 0).sort((a, b) => a - b)
  return later[0] ?? null
}
export const daysUntil = (ev, today) => { const s = nextStart(ev, today); return s ? daysBetween(today, s) : null }
// a lunar or Islamic date list with nothing set for this year or next: the Director should add it
export const needsDate = (ev, today) => ev.dateType !== 'yearly' && !nextStart(ev, today)
// where the next date comes from: 'typed' (by a Director), 'auto' (worked out), 'yearly'
export function dateSource(ev, today) {
  if (ev.dateType === 'yearly') return 'yearly'
  const s = nextStart(ev, today)
  return s && (ev.dates ?? []).includes(ymd(s)) ? 'typed' : ev.dateType === 'auto' ? 'auto' : 'typed'
}

// The pop-up the day (or days) before: returns a key that is shown once per person, or ''
export function popupKey(ev, today) {
  if (!ev.enabled || !ev.popupDaysBefore) return ''
  const s = nextStart(ev, today)
  if (!s) return ''
  const n = daysBetween(today, s)
  return n >= 1 && n <= ev.popupDaysBefore ? `${ev.id}:${ymd(s)}` : ''
}

// ----- who may see an event -----
export const visibleTo = (ev, uid) => ev.audience !== 'selected' || (ev.audienceIds ?? []).includes(uid)

// the festival shown today (Ramadan is handled separately; the first one in the list wins)
export const todaysFestival = (events, today) => events.find((e) => e.preset !== 'ramadan' && activeOn(e, today)) ?? null
export const ramadanToday = (events, today) => events.find((e) => e.preset === 'ramadan' && activeOn(e, today)) ?? null

// ----- birthday: 'MM-DD' kept in the person's own private settings -----
export const isBirthday = (mmdd, today) => typeof mmdd === 'string' && mmdd === ymd(today).slice(5)
export const BIRTHDAY = normalizeEvent({ preset: 'birthday', name: 'Birthday', color: '#e8823a', outfit: 'party', decorations: ['confetti'], greetings: ['Happy birthday, {name}! Make a wish!', 'It is your day, {name}! Happy birthday!'] })

// ----- time of day, weekdays, weather -----
export function timeOfDay(now) {
  const h = now.getHours()
  if (h >= 5 && h < 11) return 'morning'
  if (h >= 21 || h < 5) return 'night'
  return ''
}
export const weekday = (now) => ({ 1: 'monday', 5: 'friday' })[now.getDay()] ?? ''
// Open-Meteo weather codes: drizzle 51-57, rain 61-67, showers 80-82, thunderstorms 95-99
export const isRainCode = (code) => (code >= 61 && code <= 67) || (code >= 80 && code <= 82) || code >= 95
// Is it really raining? (25 Nov 2026) The weather model often says "drizzle" in Malaysia when it is dry, so drizzle
// only counts when rain was actually measured. Rain, showers and storms count; so does any 0.2 mm or more.
export const RAIN_MM = 0.2
export function isRaining({ code = null, mm = 0 } = {}) {
  if (Number.isFinite(mm) && mm >= RAIN_MM) return true
  return Number.isFinite(code) && isRainCode(code) && !(Number.isFinite(mm) && mm === 0 && code < 63) // light rain with 0 mm: no
}
const WEATHER_TEXT = { 0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Cloudy', 45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Drizzle', 57: 'Drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Rain', 67: 'Heavy rain', 80: 'Light showers', 81: 'Showers', 82: 'Heavy showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm' }
export const weatherText = (code) => WEATHER_TEXT[code] ?? 'Unknown'

export const LINES = {
  morning: ['Good morning, {name}! Coffee first, tasks next.', 'Morning! Ready for today?'],
  night: ['Time to rest, {name}. Tasks can wait till tomorrow.', 'It is late. Good night, {name}!'],
  monday: ['A new week begins!', 'Happy Monday, {name}! Let us go!'],
  friday: ['Weekend is almost here!', 'Happy Friday, {name}!'],
  rain: ['Rainy today. Stay dry, {name}!', 'Do not forget your umbrella!'],
  storm: ['Thunderstorm outside! Stay safe, {name}.', 'Boom! Stay indoors and dry.'],
  iftar: ['Almost time for buka puasa!', 'Buka puasa soon. Dates are ready!'],
}
export const fill = (text, { name = '', pet = '' } = {}) => String(text ?? '').replaceAll('{name}', name || 'friend').replaceAll('{pet}', pet || 'Your pet').trim()
export const pick = (list, rng = Math.random) => (list?.length ? list[Math.min(list.length - 1, Math.floor(rng() * list.length))] : '')

// What the pet wears and says right now.
//   outfit: today's festival outfit (it takes the place of the wardrobe outfit for the day)
//   extra:  an everyday extra added on top of everything the person chose: umbrella, nightcap, mug, sunglasses, bow tie
// rain is false, true/'rain' or 'storm'. A festival's line wins, then buka puasa, rain, Ramadan, time of day, Monday/Friday.
export function mood({ festival = null, ramadan = null, iftarSoon = false, rain = false, tod = '', day = '' }) {
  const storm = rain === 'storm'
  const wet = rain ? (storm ? ['rain', 'lightning'] : ['rain']) : []
  const extra = rain ? 'umbrella' : tod === 'night' ? 'nightcap' : tod === 'morning' ? 'mug' : day === 'friday' ? 'shades' : day === 'monday' ? 'bowtie' : ''
  if (festival) return { source: 'festival', outfit: festival.outfit, extra: rain ? 'umbrella' : '', lines: festival.greetings, decorations: [...festival.decorations, ...wet] }
  const base = { outfit: '', extra, decorations: [...(ramadan && iftarSoon ? ['greenlanterns', 'stars'] : []), ...wet] }
  if (ramadan && iftarSoon) return { ...base, source: 'iftar', lines: LINES.iftar }
  if (rain) return { ...base, source: storm ? 'storm' : 'rain', lines: storm ? LINES.storm : LINES.rain }
  if (ramadan) return { ...base, source: 'ramadan', lines: ramadan.greetings }
  if (tod) return { ...base, source: tod, lines: LINES[tod] }
  if (day) return { ...base, source: day, lines: LINES[day] }
  return { ...base, source: '', lines: [] }
}

// Buka puasa countdown: 'HH:MM' maghrib today -> ms left, shown from 3 pm until maghrib
export function iftarLeft(maghrib, now) {
  if (!/^\d{1,2}:\d{2}/.test(maghrib ?? '')) return null
  const [h, m] = maghrib.split(':').map(Number)
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)
  const left = t - now
  return left > 0 && now.getHours() >= 15 ? left : null
}
export const formatLeft = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':')
}
