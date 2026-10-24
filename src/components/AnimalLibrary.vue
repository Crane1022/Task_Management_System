<script setup>
import { ref, computed } from 'vue'
import { Search, Star, Upload } from 'lucide-vue-next'
import { ANIMALS, CATEGORIES, CUSTOM_ID, searchAnimals } from '@/companions/registry'
import CompanionAvatar from './CompanionAvatar.vue'

// Browse and search the animals. A click only PREVIEWS an animal; "Select companion" (in the page) chooses it.
const props = defineProps({ selected: String, browsing: String, favourites: { type: Array, default: () => [] }, recents: { type: Array, default: () => [] }, customUrl: String, hasCustom: Boolean })
const emit = defineEmits(['browse', 'favourite', 'upload'])

const text = ref('')
const category = ref('all')
const chips = computed(() => [
  { id: 'all', name: 'All' },
  { id: 'favourites', name: 'Favourites' },
  ...(props.recents.length ? [{ id: 'recent', name: 'Recently used' }] : []),
  ...CATEGORIES,
])
const list = computed(() => {
  if (category.value === 'favourites') return searchAnimals({ text: text.value, ids: props.favourites })
  if (category.value === 'recent') return searchAnimals({ text: text.value, ids: props.recents }).sort((a, b) => props.recents.indexOf(a.id) - props.recents.indexOf(b.id))
  return searchAnimals({ text: text.value, category: category.value === 'all' ? '' : category.value })
})
const isFav = (id) => props.favourites.includes(id)
</script>

<template>
  <div>
    <div class="relative max-w-sm">
      <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input v-model="text" class="input pl-9" placeholder="Search animals (try bunny, tikus, panda)" aria-label="Search animals" />
    </div>
    <div class="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Animal categories">
      <button v-for="c in chips" :key="c.id" role="tab" :aria-selected="category === c.id" class="rounded-full border px-3 py-1 text-xs font-bold"
        :class="category === c.id ? 'border-accent bg-accent text-on-primary' : 'border-line bg-surface text-muted hover:text-ink'" @click="category = c.id">{{ c.name }}</button>
    </div>

    <div class="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
      <button type="button" class="tile" :class="browsing === CUSTOM_ID && 'tile-on'" @click="emit('upload')">
        <span class="grid h-16 w-16 place-items-center rounded-xl bg-bg text-muted"><img v-if="hasCustom && customUrl" :src="customUrl" alt="" class="h-16 w-16 object-contain" /><Upload v-else class="h-6 w-6" /></span>
        <span class="text-[11px] font-bold">{{ hasCustom ? 'Your own picture' : 'Upload your own' }}</span>
      </button>
      <div v-for="a in list" :key="a.id" class="relative">
        <button type="button" class="tile w-full" :class="[browsing === a.id && 'tile-on', selected === a.id && 'tile-current']" :aria-pressed="browsing === a.id" :aria-label="`Preview ${a.name}`" @click="emit('browse', a.id)">
          <span class="block h-16 w-16"><CompanionAvatar :animal-id="a.id" /></span>
          <span class="text-[11px] font-bold">{{ a.name }}</span>
          <span v-if="selected === a.id" class="text-[10px] font-bold text-accent">Current</span>
        </button>
        <button type="button" class="absolute right-1 top-1 rounded-full p-1 text-muted hover:text-highlight" :class="isFav(a.id) && 'text-highlight'" :aria-label="isFav(a.id) ? `Remove ${a.name} from favourites` : `Add ${a.name} to favourites`" :aria-pressed="isFav(a.id)" @click="emit('favourite', a.id)">
          <Star class="h-4 w-4" :fill="isFav(a.id) ? 'currentColor' : 'none'" />
        </button>
      </div>
    </div>
    <p v-if="!list.length" class="mt-6 text-center text-sm text-muted">
      {{ category === 'favourites' ? 'No favourites yet. Press the star on an animal.' : category === 'recent' ? 'Nothing used yet.' : `No animal matches "${text}".` }}
    </p>
    <p class="mt-4 text-xs text-muted">{{ ANIMALS.length }} animals. More can be added without changing the app (see docs/COMPANION.md).</p>
  </div>
</template>

<style scoped>
.tile { @apply flex flex-col items-center gap-1 rounded-xl border border-line bg-surface p-2 text-center text-ink hover:border-highlight; }
.tile-on { @apply border-accent ring-2 ring-accent; }
.tile-current { @apply bg-accent-soft; }
</style>
