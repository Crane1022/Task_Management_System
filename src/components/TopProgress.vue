<script setup>
// A thin bar along the very top of the screen (25 Nov 2026) that moves while a page is opening or something is
// being saved, sent or loaded (anything that goes through ui.track() or a store's run()).
// It waits a moment before it appears, so quick saves don't make it flicker, and stays a little after, so it is seen.
import { ref, computed, watch } from 'vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const working = computed(() => ui.busy || ui.navigating)
const shown = ref(false)
const finishing = ref(false)
let showTimer, hideTimer
watch(working, (on) => {
  clearTimeout(showTimer); clearTimeout(hideTimer)
  if (on) { finishing.value = false; showTimer = setTimeout(() => (shown.value = true), 150) }
  else if (shown.value) { finishing.value = true; hideTimer = setTimeout(() => { shown.value = false; finishing.value = false }, 350) }
})
</script>

<template>
  <div v-if="shown" class="top-progress pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden" :class="finishing && 'done'" role="progressbar" aria-label="Working" aria-busy="true">
    <div class="bar" />
  </div>
</template>

<style scoped>
.top-progress { background: color-mix(in srgb, var(--accent) 18%, transparent); }
.bar { position: absolute; inset-block: 0; left: 0; width: 40%; border-radius: 999px; background: linear-gradient(90deg, var(--accent), var(--highlight)); animation: slide 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
.done .bar { animation: none; width: 100%; transition: width 0.25s ease-out; }
.done { opacity: 0; transition: opacity 0.3s 0.1s; }
@keyframes slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(260%); } }
/* Reduce motion: the bar pulses gently in place instead of sliding */
@media (prefers-reduced-motion: reduce) { .bar { width: 100%; animation: pulse 1.6s ease-in-out infinite !important; } }
:global(.reduce-motion) .bar { width: 100%; animation: pulse 1.6s ease-in-out infinite !important; }
@keyframes pulse { 50% { opacity: 0.45; } }
</style>
