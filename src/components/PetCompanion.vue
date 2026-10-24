<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { Settings2, EyeOff } from 'lucide-vue-next'
import { useCompanionStore } from '@/stores/companion'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { fitSize, toPixels, toShare, dragTo, isDrag } from '@/companions/position'
import { pickMessage, greetingFor, shouldSleep, SLEEP_AFTER_MS } from '@/companions/behaviour'
import { playVoice } from '@/companions/sound'
import CompanionAvatar from './CompanionAvatar.vue'

// The person's pet, floating above the page. Drag it anywhere; it remembers where. It never takes keyboard focus,
// and only the pet itself reacts to the mouse or touch (the layer around it lets everything through).
const store = useCompanionStore()
const auth = useAuthStore()
const theme = useThemeStore()
const router = useRouter()

const s = computed(() => store.settings)
const vw = ref(window.innerWidth)
const vh = ref(window.innerHeight)
const size = computed(() => fitSize(s.value.size, vw.value, vh.value))
const dragPos = ref(null)
const pos = computed(() => dragPos.value ?? toPixels(s.value.position, size.value, vw.value, vh.value))

// reduced motion: the operating system setting, or the app's own "reduce motion" option
const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
const osReduced = ref(mq.matches)
const onMq = (e) => (osReduced.value = e.matches)
const animated = computed(() => s.value.behaviour.animations && !osReduced.value && !theme.effective.reduceMotion)

// ----- mood -----
const asleep = ref(false)
const fx = ref('') // short effects: 'happy' | 'jump' | 'celebrate'
const look = ref('')
const hover = ref(false)
const showTools = ref(false)
const bubble = ref('')
const confetti = ref(false)
const state = computed(() => (asleep.value ? 'sleep' : fx.value || (hover.value ? 'happy' : 'idle')))
const timers = new Set()
const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn() }, ms); timers.add(t); return t }
let sleepTimer, lookTimer, bubbleTimer, fxTimer

function say(text, ms = 3200) {
  bubble.value = text
  clearTimeout(bubbleTimer)
  bubbleTimer = later(() => (bubble.value = ''), ms)
}
function effect(name, ms) {
  fx.value = name
  clearTimeout(fxTimer)
  fxTimer = later(() => (fx.value = ''), ms)
}
function wake() {
  asleep.value = false
  clearTimeout(sleepTimer)
  if (s.value.behaviour.sleep && animated.value) sleepTimer = later(() => { asleep.value = shouldSleep(SLEEP_AFTER_MS, true); if (asleep.value) say('zZz…', 2500) }, SLEEP_AFTER_MS)
}
function scheduleLook() {
  clearTimeout(lookTimer)
  lookTimer = later(() => {
    if (animated.value && !asleep.value && !dragging.value) { look.value = Math.random() < 0.5 ? 'l' : 'r'; later(() => (look.value = ''), 1600) }
    scheduleLook()
  }, 7000 + Math.random() * 6000)
}
const sound = () => { if (s.value.behaviour.sounds && store.animal) playVoice(store.animal.voice, s.value.behaviour.volume) }

// ----- reactions to what happens in the app -----
watch(() => store.reaction, (r) => {
  if (!r || !s.value.visible) return
  wake()
  say(r.text)
  if (r.type === 'completed') { effect('celebrate', 1800); confetti.value = true; later(() => (confetti.value = false), 1900); sound() }
  else if (r.type === 'created') { effect('jump', 600); sound() }
  else { look.value = 'r'; later(() => (look.value = ''), 1600) }
})

// ----- pointer: a small movement is a pat, a bigger one is a drag -----
const el = ref(null)
const dragging = ref(false)
let start = null
function down(e) {
  if (e.button !== undefined && e.button > 0) return
  el.value.setPointerCapture(e.pointerId)
  start = { x: e.clientX, y: e.clientY, left: pos.value.left, top: pos.value.top, moved: false }
  wake()
}
function move(e) {
  if (!start) return
  const dx = e.clientX - start.x, dy = e.clientY - start.y
  if (!start.moved && isDrag(dx, dy)) { start.moved = true; dragging.value = true; bubble.value = ''; showTools.value = false }
  if (start.moved) dragPos.value = dragTo(start, dx, dy, size.value, vw.value, vh.value)
}
function up(e) {
  if (!start) return
  try { el.value.releasePointerCapture(e.pointerId) } catch { /* already released */ }
  if (start.moved && dragPos.value) {
    store.setPosition(toShare(dragPos.value.left, dragPos.value.top, size.value, vw.value, vh.value)) // saved once, when the drag ends
  } else patIt()
  dragPos.value = null; dragging.value = false; start = null
}
function cancel() { dragPos.value = null; dragging.value = false; start = null }
function patIt() {
  effect('jump', 600)
  later(() => effect('happy', 1600), 600)
  say(`${s.value.name ? s.value.name + ': ' : ''}${pickMessage('pet')}`)
  showTools.value = true
  later(() => { if (!hover.value) showTools.value = false }, 3200)
  sound()
}
function enter() { hover.value = true; showTools.value = true; wake() }
function leave() { hover.value = false; later(() => { if (!hover.value && !bubble.value) showTools.value = false }, 600) }

// ----- window size, activity, greeting -----
let raf = 0
const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { vw.value = window.innerWidth; vh.value = window.innerHeight }) }
onMounted(() => {
  window.addEventListener('resize', onResize)
  window.addEventListener('pointerdown', wake, { passive: true })
  window.addEventListener('keydown', wake, { passive: true })
  mq.addEventListener('change', onMq)
  wake(); scheduleLook()
  // say hello once per browser session
  if (!sessionStorage.getItem('wb-pet-hello')) {
    sessionStorage.setItem('wb-pet-hello', '1')
    later(() => { if (s.value.visible && s.value.behaviour.greeting) { say(greetingFor(store.animal, s.value.name, (auth.profile?.displayName || auth.profile?.name || '').split(' ')[0])); effect('happy', 1800) } }, 1500)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('pointerdown', wake)
  window.removeEventListener('keydown', wake)
  mq.removeEventListener('change', onMq)
  cancelAnimationFrame(raf)
  timers.forEach(clearTimeout)
})

// the bubble stays inside the window: left-aligned near the left edge, right-aligned near the right edge
const bubbleSide = computed(() => (pos.value.left + size.value / 2 < 110 ? 'left' : pos.value.left + size.value / 2 > vw.value - 110 ? 'right' : 'mid'))
const below = computed(() => pos.value.top < 70)
</script>

<template>
  <div v-if="s.visible" class="pet-layer" aria-hidden="true">
    <div
      ref="el" class="pet" :class="{ 'pet-dragging': dragging }" :style="{ left: pos.left + 'px', top: pos.top + 'px', width: size + 'px', height: size + 'px' }"
      @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="cancel" @pointerenter="enter" @pointerleave="leave" @contextmenu.prevent
    >
      <CompanionAvatar
        :animal-id="s.animalId" :colors="s.colors" :accessory="s.accessory" :custom-url="store.urls.custom"
        :face-url="s.face.hasImage ? store.urls.face : ''" :face="s.face" :state="state" :look="look" :animated="animated"
      />
      <span v-if="confetti && animated" class="pet-confetti"><i v-for="n in 10" :key="n" :style="{ '--a': n * 36 + 'deg', '--d': 0.6 + (n % 3) * 0.15 + 's' }" /></span>

      <span v-if="bubble" class="pet-bubble" :class="[`pet-bubble-${bubbleSide}`, below && 'pet-bubble-below']">{{ bubble }}</span>
      <span v-if="showTools && !dragging" class="pet-tools" :class="below ? 'pet-tools-above' : ''">
        <span v-if="s.name" class="pet-name">{{ s.name }}</span>
        <button type="button" tabindex="-1" title="Customize my companion" @pointerdown.stop @click.stop="router.push('/settings/companion')"><Settings2 /></button>
        <button type="button" tabindex="-1" title="Hide my companion for now" @pointerdown.stop @click.stop="store.setVisible(false)"><EyeOff /></button>
      </span>
    </div>
  </div>
</template>

<style scoped>
/* the layer lets everything through; only the pet itself catches the mouse or touch */
.pet-layer { position: fixed; inset: 0; z-index: 25; pointer-events: none; }
.pet { position: absolute; pointer-events: auto; cursor: grab; touch-action: none; user-select: none; -webkit-tap-highlight-color: transparent; will-change: left, top; }
.pet-dragging { cursor: grabbing; filter: drop-shadow(0 8px 10px rgb(0 0 0 / 0.25)); }
.pet-bubble { position: absolute; bottom: 100%; margin-bottom: 4px; max-width: 190px; width: max-content; padding: 4px 10px; border-radius: 14px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 12px; font-weight: 700; line-height: 1.3; box-shadow: 0 3px 10px rgb(0 0 0 / 0.12); pointer-events: none; }
.pet-bubble-mid { left: 50%; transform: translateX(-50%); }
.pet-bubble-left { left: 0; }
.pet-bubble-right { right: 0; }
.pet-bubble-below { bottom: auto; top: 100%; margin: 4px 0 0; }
.pet-tools { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 2px; display: flex; align-items: center; gap: 4px; padding: 3px 5px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); box-shadow: 0 3px 10px rgb(0 0 0 / 0.12); white-space: nowrap; }
.pet-tools-above { top: auto; bottom: 100%; margin: 0 0 2px; }
.pet-tools button { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 999px; color: var(--muted); cursor: pointer; }
.pet-tools button:hover { background: var(--accent-soft); color: var(--accent); }
.pet-tools svg { width: 14px; height: 14px; }
.pet-name { padding: 0 4px 0 6px; font-size: 11px; font-weight: 800; color: var(--ink); }
.pet-confetti { position: absolute; left: 50%; top: 20%; width: 0; height: 0; pointer-events: none; }
.pet-confetti i { position: absolute; width: 7px; height: 7px; border-radius: 2px; background: var(--highlight); animation: pet-pop var(--d) ease-out forwards; }
.pet-confetti i:nth-child(3n) { background: var(--accent); }
.pet-confetti i:nth-child(3n + 1) { background: #ef6f8f; }
@keyframes pet-pop { from { transform: rotate(var(--a)) translateY(0) scale(1); opacity: 1; } to { transform: rotate(var(--a)) translateY(-46px) scale(0.4); opacity: 0; } }
</style>
