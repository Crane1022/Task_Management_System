<script setup>
// My companion › Festive wardrobe (25 Nov 2026). Every outfit is free: the pet gets it on the festival (or the first
// rainy day, evening, ...) and keeps it. Picking one fills the outfit place in the draft (the person's own accessory is
// kept and worn with it); "Apply changes" saves it.
// Also here: the person's own switch for festive effects (when the Director allows it) and their birthday (private).
import { computed, ref, watch } from 'vue'
import { Lock, Cake } from 'lucide-vue-next'
import CompanionAvatar from './CompanionAvatar.vue'
import { useFestiveStore } from '@/stores/festive'
import { OUTFITS, PRESETS } from '@/companions/festive'
import { ACCESSORIES, fitsWith } from '@/companions/accessories'

const props = defineProps({ modelValue: String, accessory: { type: String, default: 'none' }, animalId: String, colors: Object, face: Object, faceUrl: String, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
const festive = useFestiveStore()

const EVERYDAY = { umbrella: 'A rainy day', nightcap: 'After 9 pm', mug: 'A morning', shades: 'A Friday', bowtie: 'A Monday', party: 'Your birthday' }
const sourceOf = (id) => EVERYDAY[id] ?? festive.events.find((e) => e.outfit === id)?.name ?? PRESETS.find((p) => p.outfit === id)?.name ?? 'A special day'
const owned = computed(() => new Set(festive.mine.owned))
const filter = ref('all')
const items = computed(() => OUTFITS.filter((o) => o.id !== 'party' || owned.value.has('party'))
  .map((o) => ({ ...o, mine: owned.value.has(o.id), from: sourceOf(o.id) }))
  .filter((o) => filter.value === 'all' || (filter.value === 'mine' ? o.mine : !o.mine))
  .sort((a, b) => b.mine - a.mine))
const myAccessory = computed(() => ACCESSORIES.find((a) => a.id === props.accessory && a.id !== 'none')?.name ?? '')
const wornName = computed(() => OUTFITS.find((o) => o.id === props.modelValue)?.name ?? '')
// an outfit that sits where the accessory sits hides it while worn (the accessory itself is kept)
const hides = (id) => !!myAccessory.value && !fitsWith(props.accessory, id)
const count = computed(() => OUTFITS.filter((o) => owned.value.has(o.id)).length)

// ----- my own settings -----
const effectsOff = computed({ get: () => festive.mine.effectsOff, set: (v) => festive.saveMine({ effectsOff: v }) })
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const bMonth = ref(''), bDay = ref('')
watch(() => festive.mine.birthday, (b) => { [bMonth.value, bDay.value] = b ? b.split('-') : ['', ''] }, { immediate: true })
const savingBirthday = ref(false)
async function saveBirthday() {
  savingBirthday.value = true
  try { await festive.saveMine({ birthday: bMonth.value && bDay.value ? `${bMonth.value}-${bDay.value}` : '' }) } finally { savingBirthday.value = false }
}
const days = computed(() => Array.from({ length: bMonth.value === '02' ? 29 : ['04', '06', '09', '11'].includes(bMonth.value) ? 30 : 31 }, (_, i) => String(i + 1).padStart(2, '0')))
</script>

<template>
  <section class="card mt-4 space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <div class="min-w-0 flex-1">
        <h2 class="text-base font-extrabold">Festive wardrobe · all free</h2>
        <p class="text-sm text-muted">Festivals, rainy days and evenings give your pet a new outfit. Once you have it, it is yours to keep.</p>
      </div>
      <span class="rounded-full bg-accent-soft px-3 py-1 text-sm font-extrabold text-accent">{{ count }} of {{ OUTFITS.length }} collected</span>
    </div>
    <div class="flex gap-1.5" role="tablist" aria-label="Show outfits">
      <button v-for="f in [{ id: 'all', n: 'All' }, { id: 'mine', n: `Mine (${count})` }, { id: 'soon', n: 'Still to find' }]" :key="f.id" role="tab" :aria-selected="filter === f.id"
        class="min-h-[40px] rounded-full border px-3.5 text-sm font-extrabold" :class="filter === f.id ? 'border-accent bg-accent text-on-primary' : 'border-line bg-surface text-muted'" @click="filter = f.id">{{ f.n }}</button>
    </div>
    <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      <button v-for="o in items" :key="o.id" type="button" class="rounded-2xl border p-2 text-left disabled:cursor-not-allowed" :class="modelValue === o.id ? 'border-2 border-accent' : 'border-line'"
        :disabled="!o.mine || disabled" :aria-pressed="modelValue === o.id" @click="emit('update:modelValue', modelValue === o.id ? '' : o.id)">
        <span class="relative grid h-24 place-items-center rounded-xl" :class="o.mine ? 'bg-[#fff8ef] dark:bg-bg' : 'bg-bg'">
          <span class="h-20 w-20" :class="!o.mine && 'opacity-40 grayscale'"><CompanionAvatar :animal-id="animalId" :colors="colors" :accessory="accessory" :outfit="o.id" :face="face" :face-url="faceUrl" /></span>
          <span v-if="modelValue === o.id" class="absolute left-1.5 top-1.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-extrabold text-on-primary">Wearing</span>
          <span v-if="!o.mine" class="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-surface/90" title="Not yet"><Lock class="h-3.5 w-3.5 text-muted" /></span>
        </span>
        <span class="mt-1.5 block text-sm font-extrabold" :class="!o.mine && 'text-muted'">{{ o.name }}</span>
        <span class="block text-xs text-muted">{{ o.mine ? (hides(o.id) ? `Covers your ${myAccessory.toLowerCase()}` : 'Yours to keep') : `Comes with: ${o.from}` }}</span>
      </button>
    </div>
    <p v-if="!items.length" class="text-sm text-muted">Nothing here yet.</p>
    <div class="flex flex-wrap items-center gap-2 rounded-xl bg-bg px-3 py-2.5 text-sm">
      <span class="min-w-0 flex-1">
        <b>Wearing:</b> {{ [myAccessory, wornName].filter(Boolean).join(' + ') || 'nothing' }}.
        <span class="text-muted">Outfits are worn together with your own accessory{{ myAccessory ? ` (${myAccessory.toLowerCase()})` : '' }} and never replace it. If both sit in the same place, like two hats, the outfit shows while you wear it and your accessory comes back when you take it off.</span>
      </span>
      <button v-if="modelValue" type="button" class="btn-ghost" :disabled="disabled" @click="emit('update:modelValue', '')">Take off outfit</button>
    </div>
    <p class="text-xs text-muted">Pick one to put it on, then press Apply changes. On a festival day your pet also wears that day's outfit for the day, without changing your choices.</p>

    <div class="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
      <label v-if="festive.settings.allowOptOut" class="flex items-start justify-between gap-3 rounded-xl border border-line p-3">
        <span><span class="block text-sm font-extrabold">Festive effects</span><span class="block text-xs text-muted">Decorations, outfits, pop-ups and greetings on special days. Only changes your own screen.</span></span>
        <input v-model="effectsOff" type="checkbox" class="sr-only" :true-value="false" :false-value="true" />
        <span class="relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors" :class="!festive.mine.effectsOff ? 'bg-accent' : 'bg-line'" aria-hidden="true"><span class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left]" :class="!festive.mine.effectsOff ? 'left-[22px]' : 'left-0.5'" /></span>
      </label>
      <div v-if="festive.settings.birthdays" class="rounded-xl border border-line p-3">
        <p class="flex items-center gap-1.5 text-sm font-extrabold"><Cake class="h-4 w-4 text-accent" />My birthday</p>
        <p class="text-xs text-muted">Your pet wears a party hat and wishes you happy birthday. Only you can see this date.</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <select v-model="bMonth" class="input min-w-0 flex-1" aria-label="Birthday month"><option value="">Month</option><option v-for="(m, i) in MONTHS" :key="m" :value="String(i + 1).padStart(2, '0')">{{ m }}</option></select>
          <select v-model="bDay" class="input w-24" aria-label="Birthday day"><option value="">Day</option><option v-for="d in days" :key="d" :value="d">{{ +d }}</option></select>
          <button v-busy="savingBirthday" class="btn-ghost" @click="saveBirthday">{{ savingBirthday ? 'Saving…' : 'Save' }}</button>
        </div>
      </div>
    </div>
  </section>
</template>
