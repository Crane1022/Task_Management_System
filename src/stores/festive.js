import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from './auth'
import { useUiStore } from './ui'
import {
  subscribeFestiveSettings, saveFestiveSettings, subscribeFestiveEvents, saveFestiveEvent, deleteFestiveEvent,
  subscribeMyFestive, patchMyFestive, fetchWeather, fetchMaghrib, MINE_DEFAULT,
} from '@/services/festiveService'
import {
  DEFAULT_SETTINGS, BIRTHDAY, PRESETS, OUTFIT_IDS, outfitName, todaysFestival, ramadanToday, isBirthday, timeOfDay, weekday,
  isRaining, mood, iftarLeft, popupKey, visibleTo, ymd, fill, pick,
} from '@/companions/festive'

// Festive companion (25 Nov 2026): what the pet wears and says today, the decorations behind the app, the pop-up the
// day before a festival, and the free wardrobe. Directors also manage the events from here (Festive events page).
export const useFestiveStore = defineStore('festive', () => {
  const auth = useAuthStore()
  const ui = useUiStore()

  const settings = ref({ ...DEFAULT_SETTINGS })
  const events = ref([])
  const mine = ref({ ...MINE_DEFAULT })
  const loaded = ref(false)
  const now = ref(new Date())
  const rain = ref(false)
  const weather = ref(null) // { code, mm, time, checkedAt } — the last reading, shown on the Festive events page
  const maghrib = ref('')
  let stops = []
  let clock = null
  let weatherTimer = null

  // ----- what applies to this person today -----
  const uid = computed(() => auth.user?.uid ?? '')
  // the clock ticks every second (for the buka puasa countdown); these only change when the day or hour does
  const dayKey = computed(() => ymd(now.value))
  const today = computed(() => { const [y, m, d] = dayKey.value.split('-').map(Number); return new Date(y, m - 1, d) })
  const tod = computed(() => timeOfDay(now.value))
  const day = computed(() => weekday(now.value))
  // Directors load every event to manage them, but only see on their own screen the ones meant for them
  const forMe = computed(() => events.value.filter((e) => e.enabled && visibleTo(e, uid.value)))
  const on = computed(() => settings.value.enabled && !(settings.value.allowOptOut && mine.value.effectsOff))
  const festival = computed(() => {
    if (!on.value) return null
    if (settings.value.birthdays && isBirthday(mine.value.birthday, today.value)) return { ...BIRTHDAY, id: 'birthday' }
    return todaysFestival(forMe.value, today.value)
  })
  const ramadan = computed(() => (on.value && settings.value.ramadan ? ramadanToday(forMe.value, today.value) : null))
  const iftarMs = computed(() => (ramadan.value ? iftarLeft(maghrib.value || settings.value.maghribFallback, now.value) : null))
  const iftarSoon = computed(() => iftarMs.value != null)
  const current = computed(() => (on.value ? mood({
    festival: festival.value, ramadan: ramadan.value, iftarSoon: iftarSoon.value,
    rain: settings.value.weather && rain.value ? (weather.value?.code >= 95 ? 'storm' : 'rain') : false, tod: settings.value.timeOfDay ? tod.value : '', day: settings.value.weekly ? day.value : '',
  }) : mood({})))
  const outfit = computed(() => current.value.outfit || '') // today's festival outfit
  const extra = computed(() => current.value.extra || '')   // umbrella, nightcap, mug, sunglasses or bow tie, added on top
  const anyNew = computed(() => outfit.value || extra.value)
  const decorations = computed(() => current.value.decorations ?? [])

  // a line for the pet: { key, text }; the key changes when there is something new to say
  function line(name, pet) {
    const c = current.value
    if (!c.source || !c.lines?.length) return null
    return { key: `${ymd(today.value)}:${c.source}:${festival.value?.id ?? ''}`, text: fill(pick(c.lines), { name, pet }) }
  }

  // ----- the pop-up the day before (once per person per festival) -----
  const snoozed = ref(new Set(JSON.parse(sessionStorage.getItem('wb-festive-snooze') || '[]')))
  const popup = computed(() => {
    if (!on.value || !settings.value.popupBefore || !loaded.value) return null
    for (const e of forMe.value) {
      const key = popupKey(e, today.value)
      if (key && !mine.value.seenPopups.includes(key) && !snoozed.value.has(key)) return { key, event: e }
    }
    return null
  })
  async function closePopup(key, { later = false } = {}) {
    if (later) { // "Remind me tomorrow": hidden for this visit only
      snoozed.value = new Set([...snoozed.value, key])
      sessionStorage.setItem('wb-festive-snooze', JSON.stringify([...snoozed.value]))
      return
    }
    mine.value = { ...mine.value, seenPopups: [...mine.value.seenPopups, key] }
    await patchMyFestive(uid.value, { seenPopups: mine.value.seenPopups }).catch((e) => console.warn('Festive pop-up not saved', e.code))
  }

  // ----- free wardrobe: an outfit seen on the pet is given to the person to keep. A festival outfit shows the
  // "New outfit unlocked" message once; everyday ones (umbrella, nightcap, ...) just get a small note. -----
  const unlock = ref(null) // { outfit, from }
  watch([anyNew, loaded], async ([id, ok]) => {
    if (!ok || !id || !settings.value.wardrobe || !OUTFIT_IDS.includes(id) || mine.value.owned.includes(id)) return
    const fromFestival = id === outfit.value && current.value.source === 'festival'
    mine.value = { ...mine.value, owned: [...mine.value.owned, id] }
    await patchMyFestive(uid.value, { owned: mine.value.owned }).catch((e) => console.warn('Wardrobe not saved', e.code))
    if (fromFestival && !mine.value.seenUnlocks.includes(id)) unlock.value = { outfit: id, from: festival.value?.name ?? '' }
    else ui.toast(`New outfit in your wardrobe: ${outfitName(id)}`)
  })
  async function closeUnlock() {
    const id = unlock.value?.outfit
    unlock.value = null
    if (!id) return
    mine.value = { ...mine.value, seenUnlocks: [...mine.value.seenUnlocks, id] }
    await patchMyFestive(uid.value, { seenUnlocks: mine.value.seenUnlocks }).catch(() => {})
  }

  // ----- the person's own choices -----
  const saveMine = (patch) => ui.track(async () => { mine.value = { ...mine.value, ...patch }; await patchMyFestive(uid.value, patch) })

  // ----- outside data: weather every 30 minutes, maghrib once a day during Ramadan -----
  async function loadWeather() {
    if (!settings.value.enabled || !settings.value.weather) { rain.value = false; return }
    try {
      const w = await fetchWeather(settings.value.lat, settings.value.lon)
      weather.value = { ...w, checkedAt: new Date() }
      rain.value = isRaining(w)
    } catch (e) { console.warn('Weather not loaded:', e.message) }
  }
  // coming back to the tab after a while checks again (a laptop that slept would otherwise keep old weather)
  function onVisible() { if (document.visibilityState === 'visible' && (!weather.value || Date.now() - weather.value.checkedAt > 10 * 60 * 1000)) loadWeather() }
  let maghribDay = ''
  async function loadMaghrib() {
    if (!ramadan.value || maghribDay === ymd(today.value)) return
    maghribDay = ymd(today.value)
    try { maghrib.value = await fetchMaghrib(settings.value.prayerZone) } catch (e) { maghrib.value = ''; console.warn('Buka puasa time not loaded, using the fallback:', e.message) }
  }
  watch(ramadan, loadMaghrib)
  watch(() => [settings.value.weather, settings.value.lat, settings.value.lon, settings.value.enabled], loadWeather)

  function start() {
    stop()
    const u = uid.value
    if (!u) return
    let pending = 3
    const done = () => { if (--pending <= 0) loaded.value = true }
    stops = [
      subscribeFestiveSettings((s) => { settings.value = s; done() }, (e) => { done(); console.warn('Festive settings not loaded', e.code) }),
      subscribeFestiveEvents(u, auth.isAdmin, (list) => { events.value = list; done() }, (e) => { done(); console.warn('Festive events not loaded', e.code) }),
      subscribeMyFestive(u, (m) => { mine.value = m; done() }, (e) => { done(); console.warn('Wardrobe not loaded', e.code) }),
    ]
    clock = setInterval(() => { now.value = new Date(); loadMaghrib() }, 1000)
    weatherTimer = setInterval(loadWeather, 15 * 60 * 1000) // the weather service updates every 15 minutes
    document.addEventListener('visibilitychange', onVisible)
  }
  function stop() {
    stops.forEach((s) => s()); stops = []
    clearInterval(clock); clearInterval(weatherTimer); document.removeEventListener('visibilitychange', onVisible)
    loaded.value = false; events.value = []; mine.value = { ...MINE_DEFAULT }; rain.value = false; weather.value = null; maghrib.value = ''; maghribDay = ''
  }

  // ----- Directors -----
  const saveSettings = (patch) => ui.track(() => saveFestiveSettings({ ...settings.value, ...patch }))
  const saveEvent = (id, data) => ui.track(() => saveFestiveEvent(id, data, uid.value))
  const removeEvent = (id) => ui.track(() => deleteFestiveEvent(id))
  async function addStandardSet() {
    const have = new Set(events.value.map((e) => e.preset))
    const missing = PRESETS.filter((p) => !have.has(p.preset))
    await ui.track(async () => { for (const p of missing) await saveFestiveEvent(null, p, uid.value) })
    return missing.length
  }

  return {
    settings, events, mine, loaded, now, today, rain, weather, loadWeather, maghrib, on, festival, ramadan, iftarMs, current, outfit, extra, decorations,
    popup, unlock, line, closePopup, closeUnlock, saveMine, start, stop, saveSettings, saveEvent, removeEvent, addStandardSet,
  }
})
