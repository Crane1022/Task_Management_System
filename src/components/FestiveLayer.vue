<script setup>
// Festive companion on every page (25 Nov 2026): decorations behind the app, the buka puasa countdown in Ramadan,
// the pop-up the day before a festival (once), and the "New outfit unlocked" message (once per outfit).
import { computed, ref } from 'vue'
import { X, Moon } from 'lucide-vue-next'
import FestiveDecor from './FestiveDecor.vue'
import CompanionAvatar from './CompanionAvatar.vue'
import { useFestiveStore } from '@/stores/festive'
import { useCompanionStore } from '@/stores/companion'
import { useAuthStore } from '@/stores/auth'
import { fill, outfitName, nextStart, DECORATIONS, formatLeft } from '@/companions/festive'

const festive = useFestiveStore()
const companion = useCompanionStore()
const auth = useAuthStore()
const first = computed(() => (auth.profile?.displayName || auth.profile?.name || '').split(' ')[0])
const pet = computed(() => companion.settings.name || '') // {pet} becomes "Your pet" when the pet has no name
const s = computed(() => companion.settings)

// ----- the day-before pop-up -----
const pop = computed(() => festive.popup)
const popEvent = computed(() => pop.value?.event)
const popWhen = computed(() => { const d = popEvent.value && nextStart(popEvent.value, festive.today); return d ? d.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' }) : '' })
const popChips = computed(() => [outfitName(popEvent.value?.outfit), ...(popEvent.value?.decorations ?? []).map((d) => DECORATIONS.find((x) => x.id === d)?.name)].filter(Boolean))
const popCta = computed(() => ({ christmas: 'Ho ho ho!', raya: 'Selamat Hari Raya!', cny: 'Huat ah!', merdeka: 'Merdeka!', deepavali: 'Happy Deepavali!', halloween: 'Boo!' })[popEvent.value?.preset] ?? 'Can’t wait!')
const closingPop = ref(false)
async function donePop(later = false) {
  closingPop.value = true
  try { await festive.closePopup(pop.value.key, { later }) } finally { closingPop.value = false }
}

// ----- "New outfit unlocked" (once) -----
const unlock = computed(() => festive.unlock)
const wearing = ref(false)
async function wearNow() {
  wearing.value = true
  // fills the outfit place only: the person's own accessory stays as it is
  try { await companion.save({ ...companion.settings, outfit: unlock.value.outfit }) } finally { wearing.value = false }
  festive.closeUnlock()
}
</script>

<template>
  <FestiveDecor :decorations="festive.decorations" />

  <!-- Ramadan: buka puasa countdown, bottom left (above the phone's bottom bar) -->
  <div v-if="festive.iftarMs != null" class="iftar-chip pointer-events-none fixed left-3 z-20 flex items-center gap-2 rounded-2xl bg-[#1d2a4a] px-3 py-2 text-white shadow-xl sm:left-auto sm:right-4" role="timer" aria-live="off">
    <Moon class="h-4 w-4 text-[#f6d27a]" />
    <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#f6d27a]">Buka puasa in</span>
    <span class="text-base font-extrabold tabular-nums">{{ formatLeft(festive.iftarMs) }}</span>
  </div>

  <!-- the day before a festival -->
  <div v-if="pop && !unlock" class="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6">
    <section class="sheet w-full overflow-hidden rounded-t-3xl bg-surface shadow-2xl sm:max-w-md sm:rounded-3xl" role="dialog" aria-labelledby="fest-title">
      <div class="relative h-48 overflow-hidden" :style="{ background: (popEvent.color || '#4a7c59') + '22' }">
        <FestiveDecor :decorations="popEvent.decorations" contained />
        <div class="absolute bottom-3 left-1/2 h-28 w-28 -translate-x-1/2"><CompanionAvatar :animal-id="s.animalId" :colors="s.colors" :accessory="s.accessory" :outfit="popEvent.outfit || s.outfit" :custom-url="companion.urls.custom" :face-url="s.face.hasImage ? companion.urls.face : ''" :face="s.face" /></div>
        <button class="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-[#1f2d27] shadow" aria-label="Close" :disabled="closingPop" @click="donePop()"><X class="h-5 w-5" /></button>
      </div>
      <div class="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p class="text-xs font-extrabold uppercase tracking-wider" :style="{ color: popEvent.color }">Festival coming!</p>
        <h2 id="fest-title" class="mt-1 text-2xl font-extrabold leading-tight">{{ fill(popEvent.popupTitle || `${popEvent.name} is tomorrow!`, { name: first, pet }) }}</h2>
        <p class="mt-1 text-sm font-bold text-muted">{{ popWhen }}</p>
        <p v-if="popEvent.popupMessage" class="mt-3 text-[15px] leading-relaxed">{{ fill(popEvent.popupMessage, { name: first, pet }) }}</p>
        <ul v-if="popChips.length" class="mt-3 flex flex-wrap gap-1.5"><li v-for="c in popChips" :key="c" class="rounded-full bg-bg px-2.5 py-1 text-xs font-extrabold text-muted">{{ c }}</li></ul>
        <div class="mt-5 flex flex-col gap-2 sm:flex-row">
          <button v-busy="closingPop" class="btn flex-1 text-white" :style="{ background: popEvent.color }" @click="donePop()">{{ popCta }}</button>
          <button class="btn-ghost flex-1" :disabled="closingPop" @click="donePop(true)">Remind me tomorrow</button>
        </div>
        <p class="mt-3 text-center text-xs text-muted">Set up by your Director · Turn festive effects off in My companion</p>
      </div>
    </section>
  </div>

  <!-- a festival outfit, shown once: it stays in the wardrobe -->
  <div v-if="unlock" class="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6">
    <section class="sheet w-full overflow-hidden rounded-t-3xl bg-surface shadow-2xl sm:max-w-md sm:rounded-3xl" role="dialog" aria-labelledby="unlock-title">
      <div class="relative h-44 overflow-hidden bg-accent-soft">
        <FestiveDecor :decorations="['confetti']" contained />
        <div class="absolute bottom-3 left-1/2 h-28 w-28 -translate-x-1/2"><CompanionAvatar :animal-id="s.animalId" :colors="s.colors" :accessory="s.accessory" :outfit="unlock.outfit" :custom-url="companion.urls.custom" :face-url="s.face.hasImage ? companion.urls.face : ''" :face="s.face" /></div>
        <span class="absolute right-3 top-3 rounded-full bg-accent px-3 py-1 text-xs font-extrabold tracking-wider text-on-primary">FREE</span>
      </div>
      <div class="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p class="text-xs font-extrabold uppercase tracking-wider text-accent">New outfit unlocked</p>
        <h2 id="unlock-title" class="mt-1 text-2xl font-extrabold">{{ outfitName(unlock.outfit) }}</h2>
        <p class="mt-1 text-sm font-bold text-muted">{{ unlock.from }} · festive wardrobe</p>
        <p class="mt-3 text-[15px] leading-relaxed">A free gift for {{ pet || 'your pet' }}. It stays in your wardrobe after the festival, so {{ pet || 'your pet' }} can wear it any day you like.</p>
        <div class="mt-5 flex flex-col gap-2 sm:flex-row">
          <button v-busy="wearing" class="btn-primary flex-1" @click="wearNow">{{ wearing ? 'Putting it on…' : 'Wear it now' }}</button>
          <button class="btn-ghost flex-1" :disabled="wearing" @click="festive.closeUnlock()">Save to wardrobe</button>
        </div>
        <p class="mt-3 text-center text-xs text-muted">You will only see this once. Find it again in My companion › Festive wardrobe.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.iftar-chip { bottom: calc(76px + env(safe-area-inset-bottom)); }
@media (min-width: 640px) { .iftar-chip { bottom: 1rem; } }
</style>
