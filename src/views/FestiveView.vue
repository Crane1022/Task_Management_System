<script setup>
// Festive events (Directors only, 25 Nov 2026): the whole-company switches, and each special day's dates, outfit,
// decorations, greetings, pop-up and audience (everyone, or only the people picked).
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Plus, Sparkles, Trash2, Search, X, Users, Globe } from 'lucide-vue-next'
import { useFestiveStore } from '@/stores/festive'
import { useCompanionStore } from '@/stores/companion'
import { useUiStore } from '@/stores/ui'
import { subscribeUsers } from '@/services/userService'
import { normalizeEvent, OUTFITS, DECORATIONS, PRESETS, daysUntil, needsDate, activeOn, fill, pick, weatherText, isRaining, nextStart, dateSource, AUTO, isAuto } from '@/companions/festive'
import { displayOf } from '@/utils/constants'
import FestiveDecor from '@/components/FestiveDecor.vue'
import CompanionAvatar from '@/components/CompanionAvatar.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const festive = useFestiveStore()
const companion = useCompanionStore()
const ui = useUiStore()

// ----- people, for "Selected people" -----
const users = ref({})
let unsub
onMounted(() => { unsub = subscribeUsers((u) => (users.value = u), () => {}) })
onUnmounted(() => unsub?.())
const people = computed(() => Object.values(users.value).filter((u) => !u.pmsOff).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')))

// ----- whole-company switches -----
const SWITCHES = [
  { k: 'enabled', t: 'Festive effects', d: 'Outfits, decorations and greetings on special days' },
  { k: 'popupBefore', t: 'Pop-up before a festival', d: 'Shown once to each person, the day before' },
  { k: 'wardrobe', t: 'Free festive wardrobe', d: 'Each outfit is given to keep; the unlock message shows once' },
  { k: 'ramadan', t: 'Ramadan mode', d: 'The pet fasts in the day; buka puasa countdown in the evening' },
  { k: 'timeOfDay', t: 'Time of day', d: 'Morning coffee; after 9 pm “Time to rest”' },
  { k: 'weather', t: 'Weather', d: 'Umbrella and rain on rainy days, at the place below' },
  { k: 'weekly', t: 'Monday and Friday', d: '“A new week begins!” and “Weekend is almost here!”' },
  { k: 'birthdays', t: 'Birthdays', d: 'Each person sets their own (private) in My companion' },
  { k: 'allowOptOut', t: 'Staff may turn effects off', d: 'For their own screen only' },
]
const toggle = (k) => festive.saveSettings({ [k]: !festive.settings[k] })
const place = ref({})
watch(() => festive.settings, (s) => (place.value = { place: s.place, lat: s.lat, lon: s.lon, prayerZone: s.prayerZone, maghribFallback: s.maghribFallback }), { immediate: true })
const savingPlace = ref(false)
async function savePlace() {
  savingPlace.value = true
  try { await festive.saveSettings({ ...place.value, lat: +place.value.lat, lon: +place.value.lon, prayerZone: String(place.value.prayerZone).toUpperCase() }); ui.toast('Place saved') }
  catch (e) { ui.toast(`Could not save: ${e.code ?? e.message}`, 'error') } finally { savingPlace.value = false }
}

const checking = ref(false)
async function checkWeather() { checking.value = true; try { await festive.loadWeather() } finally { checking.value = false } }
const weatherLine = computed(() => {
  const w = festive.weather
  if (!w) return festive.settings.weather ? 'Not checked yet (or the weather service could not be reached)' : 'Weather is switched off'
  return `${weatherText(w.code)} · ${w.mm} mm in the last 15 minutes · ${isRaining(w) ? 'umbrella out' : 'no umbrella'} · checked ${w.checkedAt.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' })}`
})

// ----- the list -----
const list = computed(() => festive.events.map((e) => {
  const n = daysUntil(e, festive.today)
  const status = !e.enabled ? ['Off', 'off'] : needsDate(e, festive.today) ? ['Needs date', 'need'] : activeOn(e, festive.today) ? ['Today', 'now'] : n == null ? ['—', 'off'] : n <= 60 ? [`In ${n} day${n === 1 ? '' : 's'}`, 'soon'] : [`In ${n} days`, 'off']
  const next = nextStart(e, festive.today)
  return { ...e, n: n ?? 9999, status, nextText: next ? next.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }) : 'No date', source: dateSource(e, festive.today) }
}).sort((a, b) => (a.status[1] === 'need') - (b.status[1] === 'need') || a.n - b.n))
const STATUS = { now: 'bg-accent text-on-primary', soon: 'bg-accent-soft text-accent', need: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200', off: 'bg-bg text-muted' }
const missingPresets = computed(() => PRESETS.filter((p) => !festive.events.some((e) => e.preset === p.preset)).length)
const adding = ref(false)
async function addSet() {
  adding.value = true
  try { const n = await festive.addStandardSet(); ui.toast(n ? `Added ${n} festivals. Set the dates of the ones marked “Needs date”.` : 'All the standard festivals are already here') }
  catch (e) { ui.toast(`Could not add: ${e.code ?? e.message}`, 'error') } finally { adding.value = false }
}

// ----- the editor -----
const selectedId = ref(null) // null = nothing, 'new' = a new event
const form = ref(null)
function open(e) { selectedId.value = e.id; form.value = JSON.parse(JSON.stringify({ ...e })) }
function startNew() { selectedId.value = 'new'; form.value = normalizeEvent({ name: '', greetings: [], decorations: [] }) }
watch(() => festive.events, (evs) => { if (selectedId.value && selectedId.value !== 'new' && !evs.some((e) => e.id === selectedId.value)) { selectedId.value = null; form.value = null } })
const greetingsText = computed({ get: () => (form.value?.greetings ?? []).join('\n'), set: (v) => (form.value.greetings = v.split('\n')) })
const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
const newDate = ref('')
function addDate() { if (newDate.value && !form.value.dates.includes(newDate.value)) form.value.dates = [...form.value.dates, newDate.value].sort(); newDate.value = '' }
// the next date of the event being edited, and where it comes from
const formNext = computed(() => {
  if (!form.value) return null
  const e = normalizeEvent(form.value)
  const d = nextStart(e, festive.today)
  return { text: d ? d.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '', source: dateSource(e, festive.today) }
})
const dateTypes = computed(() => (isAuto(form.value?.preset)
  ? [{ v: 'auto', n: 'Work it out every year' }, { v: 'dates', n: 'Only dates I type' }]
  : [{ v: 'yearly', n: 'Same date every year' }, { v: 'dates', n: 'Different date each year' }]))
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// audience: everyone, or only the people picked
const pickSearch = ref('')
const pickList = computed(() => { const q = pickSearch.value.trim().toLowerCase(); return people.value.filter((u) => !q || `${u.name} ${u.email ?? ''} ${u.displayName ?? ''}`.toLowerCase().includes(q)) })
const picked = computed(() => (form.value?.audienceIds ?? []).map((id) => users.value[id] ?? { id, name: 'Someone' }))

const saving = ref(false)
async function save() {
  if (form.value.audience === 'selected' && !form.value.audienceIds.length) { ui.toast('Pick at least one person, or choose Everyone', 'error'); return }
  saving.value = true
  try {
    const id = await festive.saveEvent(selectedId.value === 'new' ? null : selectedId.value, form.value)
    selectedId.value = id
    ui.toast('Event saved')
  } catch (e) { ui.toast(`Could not save: ${e.code ?? e.message}`, 'error') } finally { saving.value = false }
}
const confirmDelete = ref(false)
async function remove() {
  try { await festive.removeEvent(selectedId.value); ui.toast('Event deleted'); selectedId.value = null; form.value = null } catch (e) { ui.toast(`Could not delete: ${e.code ?? e.message}`, 'error') }
  confirmDelete.value = false
}

// preview: the person's own pet in the outfit, with one of the greetings
const s = computed(() => companion.settings)
const sampleLine = computed(() => fill(pick(form.value?.greetings?.filter((g) => g.trim())) || `Happy ${form.value?.name || 'special day'}!`, { name: 'Crane', pet: s.value.name }))
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto max-w-6xl px-4 pb-12 pt-3 sm:pt-4">
      <div class="flex flex-wrap items-center gap-2">
        <div class="min-w-0 flex-1 basis-72">
          <h1 class="hidden text-lg font-extrabold sm:block">Festive events</h1>
          <p class="text-sm text-muted">Outfits, decorations and greetings the companion shows on special days. Only Directors can change these.</p>
        </div>
        <button v-if="missingPresets" v-busy="adding" class="btn-ghost w-full sm:w-auto" @click="addSet"><Sparkles class="h-4 w-4" />Add Malaysian festivals ({{ missingPresets }})</button>
        <button class="btn-primary w-full sm:w-auto" @click="startNew"><Plus class="h-4 w-4" />New event</button>
      </div>

      <!-- switches -->
      <section class="card mt-4 py-1">
        <div class="grid gap-x-6 sm:grid-cols-2">
          <button v-for="w in SWITCHES" :key="w.k" type="button" role="switch" :aria-checked="festive.settings[w.k]" class="flex min-h-[56px] items-center justify-between gap-3 border-b border-line text-left last:border-0 sm:[&:nth-last-child(2)]:border-0" @click="toggle(w.k)">
            <span><span class="block text-sm font-extrabold">{{ w.t }}</span><span class="block text-xs text-muted">{{ w.d }}</span></span>
            <span class="relative h-7 w-12 shrink-0 rounded-full transition-colors" :class="festive.settings[w.k] ? 'bg-accent' : 'bg-line'"><span class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left]" :class="festive.settings[w.k] ? 'left-[22px]' : 'left-0.5'" /></span>
          </button>
        </div>
      </section>
      <details class="card mt-3">
        <summary class="cursor-pointer text-sm font-extrabold">Place for weather and buka puasa time</summary>
        <div class="mt-3 grid gap-3 sm:grid-cols-5">
          <label class="sm:col-span-2"><span class="label">Place name</span><input v-model="place.place" class="input" maxlength="60" /></label>
          <label><span class="label">Latitude</span><input v-model="place.lat" class="input" inputmode="decimal" /></label>
          <label><span class="label">Longitude</span><input v-model="place.lon" class="input" inputmode="decimal" /></label>
          <label><span class="label">JAKIM zone</span><input v-model="place.prayerZone" class="input uppercase" maxlength="5" placeholder="WLY01" /></label>
          <label class="sm:col-span-2"><span class="label">Buka puasa time if the live time can't load</span><input v-model="place.maghribFallback" type="time" class="input" /></label>
          <p class="text-xs text-muted sm:col-span-3 sm:self-end">Weather comes from Open-Meteo. Buka puasa uses JAKIM e-Solat for the zone (WLY01 = Kuala Lumpur and Putrajaya).</p>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button v-busy="savingPlace" class="btn-primary" @click="savePlace">{{ savingPlace ? 'Saving…' : 'Save place' }}</button>
          <button v-busy="checking" class="btn-ghost" @click="checkWeather">{{ checking ? 'Checking…' : 'Check weather now' }}</button>
        </div>
        <p class="mt-2 rounded-lg bg-bg px-3 py-2 text-sm"><b>Now at {{ festive.settings.place }}:</b> {{ weatherLine }}</p>
        <p class="mt-1 text-xs text-muted">Weather is for this one place (not each person's own location) and updates every 15 minutes. Drizzle alone does not count as rain; 0.2 mm or more, rain, showers or storms do.</p>
      </details>

      <div class="mt-4 flex flex-wrap items-start gap-4">
        <!-- events -->
        <section class="card min-w-0 flex-[1_1_320px] p-3">
          <div class="flex items-center justify-between px-1 pb-2"><h2 class="text-sm font-extrabold">Events</h2><span class="text-xs font-bold text-muted">Next first</span></div>
          <p v-if="!list.length" class="px-1 py-6 text-center text-sm text-muted">No events yet. Add the Malaysian festivals or make a new one.</p>
          <ul class="space-y-1.5">
            <li v-for="e in list" :key="e.id">
              <button type="button" class="flex min-h-[56px] w-full items-center gap-2.5 rounded-xl border px-2.5 py-1.5 text-left" :class="selectedId === e.id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-bg'" @click="open(e)">
                <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-extrabold text-white" :style="{ background: e.color }">{{ e.name[0] }}</span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-extrabold">{{ e.name }}</span>
                  <span class="flex items-center gap-1 truncate text-xs text-muted"><component :is="e.audience === 'selected' ? Users : Globe" class="h-3 w-3 shrink-0" />{{ e.audience === 'selected' ? `${e.audienceIds.length} people` : 'Everyone' }} · {{ e.nextText }}{{ e.source === 'auto' ? ' · auto' : '' }}</span>
                </span>
                <span class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold" :class="STATUS[e.status[1]]">{{ e.status[0] }}</span>
              </button>
            </li>
          </ul>
        </section>

        <!-- editor -->
        <section v-if="form" class="card min-w-0 flex-[999_1_520px] space-y-4">
          <div class="flex items-center gap-2.5">
            <span class="grid h-9 w-9 place-items-center rounded-lg text-sm font-extrabold text-white" :style="{ background: form.color }">{{ (form.name || '?')[0] }}</span>
            <h2 class="min-w-0 flex-1 truncate text-base font-extrabold">{{ selectedId === 'new' ? 'New event' : form.name }}</h2>
            <label class="flex items-center gap-2 text-sm font-bold"><input v-model="form.enabled" type="checkbox" class="h-5 w-5 accent-[var(--accent)]" />On</label>
          </div>

          <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label><span class="label">Name</span><input v-model="form.name" class="input" maxlength="60" placeholder="e.g. Company anniversary" /></label>
            <label><span class="label">Colour</span><input v-model="form.color" type="color" class="input h-[42px] w-20 p-1" /></label>
          </div>

          <!-- dates -->
          <div>
            <span class="label">Date</span>
            <div class="flex gap-1 rounded-xl bg-bg p-1" role="radiogroup" aria-label="Date type">
              <button v-for="o in dateTypes" :key="o.v" type="button" role="radio" :aria-checked="form.dateType === o.v" class="min-h-[40px] flex-1 rounded-lg text-sm font-extrabold" :class="form.dateType === o.v ? 'bg-surface text-accent shadow' : 'text-muted'" @click="form.dateType = o.v">{{ o.n }}</button>
            </div>
            <div v-if="form.dateType === 'yearly'" class="mt-2 flex gap-2">
              <select v-model.number="form.day" class="input w-24" aria-label="Day"><option v-for="d in 31" :key="d" :value="d">{{ d }}</option></select>
              <select v-model.number="form.month" class="input flex-1" aria-label="Month"><option v-for="(m, i) in MONTHS" :key="m" :value="i + 1">{{ m }}</option></select>
            </div>
            <div v-else class="mt-2 space-y-2">
              <p v-if="form.dateType === 'auto'" class="text-xs text-muted">Worked out from the {{ AUTO[form.preset].how }} every year, so it moves to next year on its own once it has passed.<template v-if="!AUTO[form.preset].sure"> It can be a day or two off: please check the official holiday list and type the date below if it differs.</template> A date you type for a year is used instead for that year.</p>
              <p v-else class="text-xs text-muted">Only the dates you add are used. Add each year's first day.</p>
              <p class="text-xs font-extrabold uppercase tracking-wide text-muted">{{ form.dateType === 'auto' ? 'Official dates (optional)' : 'Dates' }}</p>
              <div class="flex flex-wrap gap-1.5">
                <span v-for="d in form.dates" :key="d" class="flex items-center gap-1 rounded-full bg-accent-soft py-1 pl-3 pr-1 text-sm font-bold text-accent">{{ new Date(d + 'T00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) }}<button type="button" class="grid h-7 w-7 place-items-center rounded-full hover:bg-surface" :aria-label="`Remove ${d}`" @click="form.dates = form.dates.filter((x) => x !== d)"><X class="h-3.5 w-3.5" /></button></span>
                <span v-if="!form.dates.length && form.dateType === 'dates'" class="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">No date yet</span>
              </div>
              <div class="flex gap-2"><input v-model="newDate" type="date" class="input flex-1" aria-label="Add a date" /><button type="button" class="btn-ghost" :disabled="!newDate" @click="addDate"><Plus class="h-4 w-4" />Add</button></div>
            </div>
          </div>
          <p v-if="formNext" class="-mt-2 rounded-lg bg-bg px-3 py-2 text-sm">
            <template v-if="formNext.text"><b>Next:</b> {{ formNext.text }} <span class="text-muted">· {{ { auto: 'worked out', typed: 'typed in', yearly: 'every year' }[formNext.source] }}</span></template>
            <span v-else class="font-bold text-amber-700 dark:text-amber-300">No date yet. Add one above.</span>
          </p>
          <div class="grid gap-3 sm:grid-cols-2">
            <label><span class="label">Shows for</span><select v-model.number="form.days" class="input"><option v-for="d in [1, 2, 3, 5, 7, 14, 30]" :key="d" :value="d">{{ d }} day{{ d === 1 ? '' : 's' }}</option></select></label>
            <label><span class="label">Pop-up before the day</span><select v-model.number="form.popupDaysBefore" class="input"><option :value="0">No pop-up</option><option v-for="d in [1, 2, 3, 7]" :key="d" :value="d">{{ d }} day{{ d === 1 ? '' : 's' }} before</option></select></label>
          </div>

          <!-- who sees it -->
          <div>
            <span class="label">Who sees it</span>
            <div class="flex gap-1 rounded-xl bg-bg p-1" role="radiogroup" aria-label="Who sees it">
              <button type="button" role="radio" :aria-checked="form.audience === 'all'" class="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-extrabold" :class="form.audience === 'all' ? 'bg-surface text-accent shadow' : 'text-muted'" @click="form.audience = 'all'"><Globe class="h-4 w-4" />Everyone</button>
              <button type="button" role="radio" :aria-checked="form.audience === 'selected'" class="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-extrabold" :class="form.audience === 'selected' ? 'bg-surface text-accent shadow' : 'text-muted'" @click="form.audience = 'selected'"><Users class="h-4 w-4" />Selected people</button>
            </div>
            <div v-if="form.audience === 'selected'" class="mt-2 rounded-xl border border-line p-2">
              <p class="px-1 text-xs text-muted">Only these people see this event, its pop-up and its outfit. Nobody else can open it.</p>
              <div v-if="picked.length" class="mt-2 flex flex-wrap gap-1.5 px-1">
                <span v-for="u in picked" :key="u.id" class="flex items-center gap-1.5 rounded-full bg-accent-soft py-0.5 pl-0.5 pr-1 text-sm font-bold"><UserAvatar :user="u" :size="24" />{{ displayOf(u) }}<button type="button" class="grid h-6 w-6 place-items-center rounded-full hover:bg-surface" :aria-label="`Remove ${displayOf(u)}`" @click="form.audienceIds = form.audienceIds.filter((x) => x !== u.id)"><X class="h-3.5 w-3.5" /></button></span>
              </div>
              <div class="relative mt-2"><Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input v-model="pickSearch" class="input pl-9" placeholder="Search staff" aria-label="Search staff" /></div>
              <ul class="mt-1 max-h-56 overflow-y-auto overscroll-contain">
                <li v-for="u in pickList" :key="u.id"><label class="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg px-2 hover:bg-bg"><input type="checkbox" class="h-5 w-5 accent-[var(--accent)]" :checked="form.audienceIds.includes(u.id)" @change="form.audienceIds = toggleIn(form.audienceIds, u.id)" /><UserAvatar :user="u" :size="28" /><span class="min-w-0 flex-1"><span class="block truncate text-sm font-bold">{{ displayOf(u) }}</span><span class="block truncate text-xs text-muted">{{ u.email }}</span></span></label></li>
              </ul>
            </div>
          </div>

          <!-- look -->
          <div>
            <span class="label">Pet outfit · given free, kept in each person's wardrobe</span>
            <div class="flex flex-wrap gap-1.5">
              <button type="button" class="min-h-[38px] rounded-full border px-3 text-sm font-bold" :class="!form.outfit ? 'border-accent bg-accent text-on-primary' : 'border-line text-muted'" @click="form.outfit = ''">None</button>
              <button v-for="o in OUTFITS" :key="o.id" type="button" class="min-h-[38px] rounded-full border px-3 text-sm font-bold" :class="form.outfit === o.id ? 'border-accent bg-accent text-on-primary' : 'border-line text-muted'" @click="form.outfit = o.id">{{ o.name }}</button>
            </div>
          </div>
          <div>
            <span class="label">Background decorations (pick any)</span>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="d in DECORATIONS" :key="d.id" type="button" class="min-h-[38px] rounded-full border px-3 text-sm font-bold" :class="form.decorations.includes(d.id) ? 'border-accent bg-accent text-on-primary' : 'border-line text-muted'" :aria-pressed="form.decorations.includes(d.id)" @click="form.decorations = toggleIn(form.decorations, d.id)">{{ d.name }}</button>
            </div>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <label><span class="label">Greetings (one per line, picked at random)</span><textarea v-model="greetingsText" rows="4" class="input" placeholder="Merry Christmas, {name}!" /><span class="mt-1 block text-xs text-muted">{name} = each person's first name, {pet} = their pet's name</span></label>
            <div class="space-y-3">
              <label class="block"><span class="label">Pop-up title</span><input v-model="form.popupTitle" class="input" maxlength="80" :placeholder="`${form.name || 'It'} is tomorrow!`" /></label>
              <label class="block"><span class="label">Pop-up message</span><textarea v-model="form.popupMessage" rows="2" class="input" maxlength="300" /></label>
            </div>
          </div>

          <!-- preview -->
          <div>
            <span class="label">Live preview</span>
            <div class="relative h-60 overflow-hidden rounded-2xl border border-line" :style="{ background: form.color + '1f' }">
              <FestiveDecor :decorations="form.decorations" contained />
              <div class="absolute bottom-3 left-1/2 h-28 w-28 -translate-x-1/2">
                <span class="pet-bubble absolute bottom-full left-1/2 mb-1 w-max max-w-[240px] -translate-x-1/2 rounded-2xl border border-line bg-surface px-3 py-1 text-center text-xs font-extrabold shadow">{{ sampleLine }}</span>
                <CompanionAvatar :animal-id="s.animalId" :colors="s.colors" :accessory="s.accessory" :outfit="form.outfit" :custom-url="companion.urls.custom" :face-url="s.face.hasImage ? companion.urls.face : ''" :face="s.face" />
              </div>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 border-t border-line pt-4">
            <button v-if="selectedId !== 'new'" class="btn-ghost w-full text-red-600 sm:w-auto" @click="confirmDelete = true"><Trash2 class="h-4 w-4" />Delete event</button>
            <span class="hidden flex-1 sm:block" />
            <button class="btn-ghost w-full sm:w-auto" :disabled="saving" @click="selectedId = null; form = null">Close</button>
            <button v-busy="saving" class="btn-primary w-full sm:w-auto" @click="save">{{ saving ? 'Saving…' : 'Save event' }}</button>
          </div>
        </section>
        <section v-else class="card hidden min-w-0 flex-[999_1_520px] place-items-center py-16 text-center text-sm text-muted sm:grid">Pick an event to change it, or press New event.</section>
      </div>
    </div>
    <ConfirmDialog v-if="confirmDelete" :title="`Delete ${form?.name}?`" message="It disappears for everyone. Outfits people already have stay in their wardrobes." confirm-text="Delete" @cancel="confirmDelete = false" @confirm="remove" />
  </div>
</template>

<style scoped>
.card { @apply rounded-2xl border border-line bg-surface p-4 shadow-card; }
</style>
