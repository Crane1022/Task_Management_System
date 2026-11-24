<script setup>
import { shallowRef, computed, watch } from 'vue'
import { loadArt, composePetSvg } from '@/companions/compose'
import { effectiveColors, colorsToStyle } from '@/companions/settings'
import { CUSTOM_ID, DEFAULT_ANIMAL } from '@/companions/registry'

// One pet, drawn. Used for the roaming companion, the library tiles and the live preview.
//   animated: idle loops (blink, breathe, tail, ears). state: 'idle' | 'happy' | 'sleep' | 'jump' | 'celebrate' | 'dance' | 'sing'
const props = defineProps({
  animalId: { type: String, default: DEFAULT_ANIMAL },
  colors: { type: Object, default: () => ({}) },
  accessory: { type: String, default: 'none' },
  customUrl: { type: String, default: '' }, // the uploaded character (a picture)
  faceUrl: { type: String, default: '' },   // a photo shown on the face of a built-in animal
  face: { type: Object, default: () => ({ zoom: 1, x: 0, y: 0 }) },
  state: { type: String, default: 'idle' },
  look: { type: String, default: '' },
  animated: { type: Boolean, default: false },
})

const uid = Math.random().toString(36).slice(2, 8) // keeps the face-photo mask ids unique when several pets are on screen
const blink = `-${(Math.random() * 5).toFixed(2)}s`  // so a row of pets does not blink in step
const isCustom = computed(() => props.animalId === CUSTOM_ID && !!props.customUrl)
// an uploaded character that is not on this device falls back to the default cat
const shownId = computed(() => (props.animalId === CUSTOM_ID ? DEFAULT_ANIMAL : props.animalId))

const art = shallowRef(null)
watch(shownId, async (id) => {
  const mine = id
  const loadedArt = await loadArt(id)
  if (mine === shownId.value) art.value = loadedArt // ignore an answer for an animal that is no longer chosen
}, { immediate: true })

const markup = computed(() => composePetSvg({
  art: art.value, uid, accessory: props.accessory,
  photo: props.faceUrl ? { href: props.faceUrl, zoom: props.face.zoom, x: props.face.x, y: props.face.y } : null,
}))
const cssVars = computed(() => ({ ...colorsToStyle(effectiveColors(shownId.value, props.colors)), '--blink': blink }))
const rootClass = computed(() => ({
  'pet-anim': props.animated,
  [`pet-${props.state}`]: props.state !== 'idle',
  'pet-look-l': props.look === 'l',
  'pet-look-r': props.look === 'r',
}))
</script>

<template>
  <div class="pet-root" :class="rootClass" aria-hidden="true">
    <img v-if="isCustom" :src="customUrl" class="pet-raster" alt="" draggable="false" />
    <svg v-else-if="markup" class="pet-svg" viewBox="0 0 100 100" :style="cssVars" v-html="markup" />
    <!-- easter egg: a neon dance floor with sparkles, or music notes floating up -->
    <span v-if="state === 'dance'" class="pet-neon"><b /><i v-for="n in 4" :key="n">✦</i></span>
    <span v-else-if="state === 'sing'" class="pet-notes"><i>♪</i><i>♫</i><i>♪</i></span>
  </div>
</template>

<style>
/* Not scoped on purpose: the drawing is inserted as markup, so scoped styles would not reach it. All names start with pet-. */
.pet-root { position: relative; width: 100%; height: 100%; user-select: none; -webkit-user-drag: none; container-type: inline-size; }
.pet-svg, .pet-raster { display: block; width: 100%; height: 100%; overflow: visible; }
.pet-raster { object-fit: contain; transform-origin: 50% 100%; pointer-events: none; }
.pet-head { transition: transform 0.5s ease; transform-origin: 50px 62px; }

/* idle loops: cheap transform animations only, and they stop when animations are switched off or motion is reduced */
.pet-anim .pet-eyes { animation: pet-blink 5.5s infinite; animation-delay: var(--blink, 0s); }
.pet-anim .pet-body { animation: pet-breathe 3.8s ease-in-out infinite; }
.pet-anim .pet-tail { animation: pet-wag 2.6s ease-in-out infinite; }
.pet-anim .pet-ear-l { animation: pet-twitch 7s infinite; }
.pet-anim .pet-ear-r { animation: pet-twitch 7s 3.4s infinite; }
.pet-anim .pet-raster { animation: pet-breathe-r 3.8s ease-in-out infinite; }
@keyframes pet-blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.08); } }
@keyframes pet-breathe { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.025); } }
@keyframes pet-breathe-r { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.01, 1.035); } }
@keyframes pet-wag { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(7deg); } }
@keyframes pet-twitch { 0%, 90%, 100% { transform: rotate(0); } 93% { transform: rotate(-9deg); } 96% { transform: rotate(4deg); } }

/* looking around */
.pet-look-l .pet-head { transform: translateX(-2px) rotate(-3deg); }
.pet-look-r .pet-head { transform: translateX(2px) rotate(3deg); }

/* moods */
.pet-happy .pet-eyes { transform: scaleY(0.3); animation: none; }
.pet-happy .pet-blush { opacity: 0.75; }
.pet-happy .pet-tail { animation: pet-wag 0.35s ease-in-out infinite; }
.pet-sleep .pet-eyes { transform: scaleY(0.08); animation: none; }
.pet-sleep .pet-head { transform: translateY(2px) rotate(4deg); }
.pet-sleep .pet-body, .pet-sleep .pet-raster { animation-duration: 7s; }
.pet-sleep .pet-raster { filter: brightness(0.92) saturate(0.85); }
.pet-happy .pet-raster { animation: pet-wiggle 0.5s 2; }
@keyframes pet-wiggle { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }

/* jumping (a pat, a new task) and celebrating (a finished task) */
.pet-jump { animation: pet-jump 0.55s ease-out; }
.pet-celebrate { animation: pet-jump 0.55s ease-out 3; }
@keyframes pet-jump { 0%, 100% { transform: translateY(0) scale(1, 1); } 20% { transform: translateY(0) scale(1.06, 0.92); } 50% { transform: translateY(-16%) scale(0.97, 1.05); } 80% { transform: translateY(0) scale(1.04, 0.95); } }

/* ---------- easter egg (20 Nov 2026): dancing under neon lights, or singing ---------- */
.pet-dance .pet-svg, .pet-dance .pet-raster { transform-origin: 50% 100%; animation: pet-dance 1.1s ease-in-out infinite, pet-neon 2.4s linear infinite; }
.pet-dance .pet-eyes, .pet-sing .pet-eyes { transform: scaleY(0.3); animation: none; }
.pet-dance .pet-blush, .pet-sing .pet-blush { opacity: 0.75; }
.pet-dance .pet-tail { animation: pet-wag 0.28s ease-in-out infinite; }
.pet-dance .pet-head { animation: pet-groove 0.55s ease-in-out infinite; }
.pet-sing .pet-svg, .pet-sing .pet-raster { transform-origin: 50% 100%; animation: pet-sway 1.6s ease-in-out infinite; }
.pet-sing .pet-head { animation: pet-groove 0.8s ease-in-out infinite; }
.pet-sing .pet-tail { animation: pet-wag 1.6s ease-in-out infinite; }
@keyframes pet-dance {
  0%, 100% { transform: translate(0, 0) rotate(0) scale(1, 1); }
  12% { transform: translate(-4%, -12%) rotate(-9deg) scale(0.97, 1.04); }
  25% { transform: translate(0, 0) rotate(0) scale(1.06, 0.93); }
  37% { transform: translate(4%, -12%) rotate(9deg) scale(0.97, 1.04); }
  50% { transform: translate(0, 0) rotate(0) scale(1.06, 0.93); }
  62% { transform: translate(-6%, -3%) rotate(-5deg); }
  75% { transform: translate(6%, -3%) rotate(5deg); }
  87% { transform: translate(0, -16%) rotate(360deg) scale(1); }
}
@keyframes pet-neon {
  0%, 100% { filter: drop-shadow(0 0 3px #ff2bd6) drop-shadow(0 0 9px #ff2bd6); }
  33% { filter: drop-shadow(0 0 3px #22e4ff) drop-shadow(0 0 9px #22e4ff); }
  66% { filter: drop-shadow(0 0 3px #a6ff2b) drop-shadow(0 0 9px #a6ff2b); }
}
@keyframes pet-groove { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg) translateY(1px); } }
@keyframes pet-sway { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }

/* the neon dance floor under the pet, with sparkles around it */
.pet-neon { position: absolute; inset: 0; pointer-events: none; }
.pet-neon b { position: absolute; left: 12%; right: 12%; bottom: -4%; height: 12%; border-radius: 50%; background: #ff2bd6; filter: blur(5px); opacity: 0.55; animation: pet-floor 2.4s linear infinite; }
.pet-neon i { position: absolute; font-size: 14px; font-size: 13cqw; font-style: normal; line-height: 1; color: #22e4ff; text-shadow: 0 0 6px currentColor; animation: pet-twinkle 1.2s ease-in-out infinite; }
.pet-neon i:nth-of-type(1) { left: -6%; top: 14%; }
.pet-neon i:nth-of-type(2) { right: -6%; top: 6%; color: #ff2bd6; animation-delay: 0.3s; }
.pet-neon i:nth-of-type(3) { left: 2%; top: 58%; color: #a6ff2b; animation-delay: 0.6s; }
.pet-neon i:nth-of-type(4) { right: -2%; top: 52%; color: #ffd52b; animation-delay: 0.9s; }
@keyframes pet-floor { 0%, 100% { background: #ff2bd6; transform: scaleX(1); } 33% { background: #22e4ff; transform: scaleX(0.85); } 66% { background: #a6ff2b; transform: scaleX(1.05); } }
@keyframes pet-twinkle { 0%, 100% { opacity: 0.2; transform: scale(0.6) rotate(0); } 50% { opacity: 1; transform: scale(1.15) rotate(45deg); } }

/* music notes floating up from the singer */
.pet-notes { position: absolute; inset: 0; pointer-events: none; }
.pet-notes i { position: absolute; right: 2%; top: 22%; font-size: 15px; font-size: 16cqw; font-style: normal; font-weight: 800; line-height: 1; color: var(--accent); opacity: 0; animation: pet-note 2.4s ease-out infinite; }
.pet-notes i:nth-child(2) { right: 18%; color: #ef6f8f; animation-delay: 0.8s; }
.pet-notes i:nth-child(3) { right: -6%; color: var(--highlight); animation-delay: 1.6s; }
@keyframes pet-note { 0% { opacity: 0; transform: translate(0, 0) rotate(-10deg) scale(0.7); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(14px, -46px) rotate(14deg) scale(1.1); } }

@media (prefers-reduced-motion: reduce) {
  .pet-root, .pet-root * { animation: none !important; transition: none !important; }
}
</style>
