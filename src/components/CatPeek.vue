<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { SKINS } from '@/companions/catSkins'
import { useCompanionStore } from '@/stores/companion'

// A small cat that peeks over the top edge of its parent (parent must be `relative`).
// Hover (or tap on phones) and it pops up, twitches its ears and says something.
const props = defineProps({ variant: { type: String, default: 'orange' }, side: { type: String, default: 'right' } })

const skin = computed(() => SKINS[props.variant] ?? SKINS.orange)
const stripes = computed(() => ['orange', 'gray'].includes(props.variant))

// a person can switch the peeking cats off in My companion (they are on by default, as before)
const companion = useCompanionStore()
const show = computed(() => companion.settings.behaviour.peekCats)

const active = ref(false)
let timer
const pop = () => { active.value = true; clearTimeout(timer) }
const hide = () => { clearTimeout(timer); active.value = false }
const tap = () => { pop(); timer = setTimeout(hide, 2500) } // touch screens have no hover
onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <div
    v-if="show" class="absolute -top-[26px] z-10 h-[26px] w-12" :class="side === 'left' ? 'left-4' : 'right-4'" aria-hidden="true"
    @mouseenter="pop" @mouseleave="hide" @click.stop="tap"
  >
    <span
      class="bubble pointer-events-none absolute top-0 whitespace-nowrap rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-bold text-ink shadow-card transition duration-200"
      :class="[side === 'left' ? 'left-full ml-1 origin-left' : 'right-full mr-1 origin-right', active ? 'scale-100 opacity-100' : 'scale-50 opacity-0']"
    >{{ skin.msg }}</span>

    <div class="h-full w-full overflow-hidden">
      <svg viewBox="0 0 48 26" class="cat" :class="{ up: active }">
        <g class="ear ear-l"><polygon points="5,17 8,0 19,9" :fill="skin.fur" /><polygon points="8,13 9.5,4 15,9" :fill="skin.ear" /></g>
        <g class="ear ear-r"><polygon points="43,17 40,0 29,9" :fill="skin.fur" /><polygon points="40,13 38.5,4 33,9" :fill="skin.ear" /></g>
        <ellipse cx="24" cy="24" rx="20" ry="16" :fill="skin.fur" />
        <template v-if="variant === 'calico'">
          <ellipse cx="13" cy="13" rx="7" ry="6" :fill="skin.mark" /><ellipse cx="36" cy="14" rx="5" ry="4" fill="#4a4540" />
        </template>
        <path v-if="stripes" d="M24 9v4M19.5 9.5l1.2 3M28.5 9.5l-1.2 3" :stroke="skin.mark" stroke-width="1.6" stroke-linecap="round" fill="none" />
        <template v-if="!active">
          <circle cx="16" cy="15" r="2.1" :fill="skin.eye" /><circle cx="32" cy="15" r="2.1" :fill="skin.eye" />
          <circle cx="16.7" cy="14.3" r=".7" fill="#fff" /><circle cx="32.7" cy="14.3" r=".7" fill="#fff" />
        </template>
        <path v-else d="M13 16.5q3-4 6 0M29 16.5q3-4 6 0" :stroke="skin.eye" stroke-width="1.5" stroke-linecap="round" fill="none" />
        <ellipse v-if="active" cx="11" cy="20" rx="3" ry="1.8" fill="#f4a3b3" opacity=".6" /><ellipse v-if="active" cx="37" cy="20" rx="3" ry="1.8" fill="#f4a3b3" opacity=".6" />
        <path d="M22.5 19.5h3l-1.5 2z" fill="#e58a95" />
        <path d="M24 21.5v1.5M24 23q-2 2-4 .5M24 23q2 2 4 .5" stroke="#6b4a4a" stroke-width="1" stroke-linecap="round" fill="none" />
        <path d="M9 20l-8-1.5M9 22.5l-8 1.5M39 20l8-1.5M39 22.5l8 1.5" stroke="#8a8478" stroke-width=".8" stroke-linecap="round" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.cat { width: 100%; height: 100%; transform: translateY(15px); transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.cat.up { transform: translateY(0); }
.ear { transform-box: fill-box; transform-origin: 50% 100%; }
.cat.up .ear-l { animation: twitch 0.5s 0.15s ease-in-out; }
.cat.up .ear-r { animation: twitch 0.5s 0.3s ease-in-out reverse; }
@keyframes twitch { 0%, 100% { transform: rotate(0); } 30% { transform: rotate(-14deg); } 65% { transform: rotate(8deg); } }
</style>
