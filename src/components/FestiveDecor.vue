<script setup>
// Festive decorations (25 Nov 2026): snow, lanterns, fireworks and the rest, drawn BEHIND the app so they never cover
// a task or catch a click. `contained` draws them inside a box instead (previews on the Festive events page and pop-ups).
// Reduce motion (the person's or the system's) stops the movement; the decorations stay.
import { computed } from 'vue'

const props = defineProps({ decorations: { type: Array, default: () => [] }, contained: Boolean })
const has = (id) => props.decorations.includes(id)
const any = computed(() => props.decorations.length > 0)
const r = (i, m) => ((i * 9301 + 49297) % 233280) / 233280 * m // the same "random" spots every time

const fall = (n, seed, extra) => Array.from({ length: n }, (_, i) => ({
  left: r(i + seed, 100).toFixed(1) + '%', size: extra.size(i), dur: (extra.dur + r(i + seed + 3, extra.spread)).toFixed(1) + 's',
  delay: -r(i + seed + 9, 8).toFixed(1) + 's', y: r(i + seed + 5, 85).toFixed(0) + '%', color: extra.colors ? extra.colors[i % extra.colors.length] : '',
}))
const snow = fall(36, 1, { size: (i) => 3 + Math.round(r(i + 7, 4)), dur: 7, spread: 6 })
const confetti = fall(26, 4, { size: () => 7, dur: 6, spread: 4, colors: ['#e8823a', '#3f7a96', '#a8566f', '#f2c94c', '#4a7c59'] })
// rain falls gently (25 Nov 2026: was 0.9–1.6 s, too fast and busy)
const rain = fall(34, 2, { size: () => 2, dur: 2.2, spread: 1.2 })
const hearts = Array.from({ length: 12 }, (_, i) => ({ left: r(i + 5, 96).toFixed(1) + '%', size: 14 + Math.round(r(i + 2, 14)), dur: (8 + r(i + 1, 6)).toFixed(1) + 's', delay: -r(i + 9, 10).toFixed(1) + 's', y: r(i + 4, 70).toFixed(0) + '%', color: ['#d6456b', '#f08aa5', '#e8616f'][i % 3] }))
const stars = Array.from({ length: 18 }, (_, i) => ({ left: r(i + 8, 100).toFixed(1) + '%', top: (8 + r(i + 3, 40)).toFixed(1) + '%', dur: (1.5 + r(i, 2)).toFixed(1) + 's' }))
const bursts = [[8, 10, '#f2c94c', 0], [72, 6, '#e05a8a', 0.6], [40, 18, '#5cc2b3', 1.1], [86, 26, '#b79df0', 0.3], [22, 30, '#f2a93b', 1.5]]
const hanging = (n) => Array.from({ length: n }, (_, i) => ({ right: 4 + i * 9 + '%', len: [36, 18, 52, 26][i % 4] + 'px', delay: i * 0.5 + 's' }))
</script>

<template>
  <div v-if="any" class="festive-decor pointer-events-none overflow-hidden" :class="contained ? 'absolute inset-0' : 'fixed inset-0 -z-[5]'" aria-hidden="true">
    <!-- falling and floating things -->
    <template v-if="has('snow')"><span v-for="(f, i) in snow" :key="'s' + i" class="fd-fall fd-snow" :style="{ left: f.left, width: f.size + 'px', height: f.size + 'px', animationDuration: f.dur, animationDelay: f.delay, '--y': f.y }" /></template>
    <template v-if="has('confetti')"><span v-for="(f, i) in confetti" :key="'c' + i" class="fd-fall fd-confetti" :style="{ left: f.left, background: f.color, animationDuration: f.dur, animationDelay: f.delay, '--y': f.y }" /></template>
    <!-- thunderstorm: a soft flash now and then (none with Reduce motion) and a bolt in the corner -->
    <template v-if="has('lightning')">
      <span class="fd-flash" />
      <svg class="fd-bolt" width="56" height="90" viewBox="0 0 56 90"><path d="M30 2L6 50h18L14 88l36-52H30L42 2z" fill="#f2c94c" stroke="#d4a437" stroke-width="2" stroke-linejoin="round" /></svg>
    </template>
    <template v-if="has('rain')"><span v-for="(f, i) in rain" :key="'r' + i" class="fd-fall fd-rain" :style="{ left: f.left, animationDuration: f.dur, animationDelay: f.delay, '--y': f.y }" /></template>
    <template v-if="has('hearts')"><svg v-for="(h, i) in hearts" :key="'h' + i" class="fd-heart" :style="{ left: h.left, width: h.size + 'px', height: h.size + 'px', animationDuration: h.dur, animationDelay: h.delay, '--y': h.y }" viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" :fill="h.color" /></svg></template>
    <template v-if="has('stars')"><span v-for="(s, i) in stars" :key="'t' + i" class="fd-star" :style="{ left: s.left, top: s.top, animationDuration: s.dur }" /></template>
    <template v-if="has('fireworks')"><svg v-for="(b, i) in bursts" :key="'f' + i" class="fd-burst" :style="{ left: b[0] + '%', top: b[1] + '%', animationDelay: b[3] + 's' }" width="110" height="110" viewBox="0 0 120 120"><g :stroke="b[2]" stroke-width="4" stroke-linecap="round"><path d="M60 8v24M60 88v24M8 60h24M88 60h24M23 23l17 17M80 80l17 17M97 23L80 40M40 80L23 97" /></g><circle cx="60" cy="60" r="6" :fill="b[2]" /></svg></template>

    <!-- across the top -->
    <svg v-if="has('bunting') || has('marigolds')" class="fd-top-band" viewBox="0 0 390 60" preserveAspectRatio="none">
      <path d="M0 6q195 46 390 0" fill="none" stroke="#8a6a2f" stroke-width="1.5" />
      <template v-if="has('bunting')"><path v-for="(c, i) in ['#cc1f2f', '#fff', '#1f3a7a', '#f2c94c', '#cc1f2f', '#fff']" :key="i" :d="`M${20 + i * 62} ${12 + Math.sin((i + 0.5) / 6 * Math.PI) * 22}l10 20l10-18z`" :fill="c" stroke="rgba(0,0,0,.08)" /></template>
      <template v-else><circle v-for="i in 15" :key="i" :cx="i * 25" :cy="8 + Math.sin(i / 16 * Math.PI) * 26" r="6" :fill="i % 2 ? '#f08a24' : '#f2c94c'" /></template>
    </svg>
    <div v-if="has('lanterns') || has('greenlanterns') || has('ketupat') || has('lotus')" class="fd-hang-row">
      <div v-for="(h, i) in hanging(3)" :key="i" class="fd-hang" :style="{ right: h.right, animationDelay: h.delay }">
        <span class="fd-string" :style="{ height: h.len }" />
        <svg v-if="has('lanterns')" width="46" height="60" viewBox="0 0 54 70"><rect x="17" width="20" height="6" rx="2" fill="#d4a437" /><ellipse cx="27" cy="30" rx="26" ry="24" fill="#d1342a" /><path d="M27 6v48M10 12q-8 18 0 36M44 12q8 18 0 36" stroke="#a8261e" stroke-width="2" fill="none" /><rect x="17" y="52" width="20" height="6" rx="2" fill="#d4a437" /><path d="M22 58v12M27 58v12M32 58v12" stroke="#d4a437" stroke-width="2" /></svg>
        <svg v-else-if="has('greenlanterns')" width="34" height="54" viewBox="0 0 40 62"><path d="M20 0l8 8H12z" fill="#d4a437" /><rect x="8" y="8" width="24" height="40" rx="10" fill="#2f6b4f" stroke="#d4a437" stroke-width="2" /><rect x="14" y="16" width="12" height="24" rx="5" fill="#f6d27a" class="fd-glow" /><path d="M14 48h12l-6 10z" fill="#d4a437" /></svg>
        <svg v-else-if="has('ketupat')" width="40" height="48" viewBox="0 0 44 52"><path d="M22 2l20 24l-20 24L2 26z" fill="#e9c46a" stroke="#8a6a2f" stroke-width="2" /><path d="M12 14l20 24M32 14L12 38M22 2v48" stroke="#5f8d4e" stroke-width="3" /></svg>
        <svg v-else width="48" height="38" viewBox="0 0 56 44"><ellipse cx="28" cy="30" rx="18" ry="12" fill="#f6d27a" opacity=".45" /><path d="M28 6q8 12 0 26q-8-14 0-26zM12 14q14 4 16 18q-14-2-16-18zM44 14q-14 4-16 18q14-2 16-18z" fill="#f2a7c1" stroke="#d6799b" stroke-width="1.5" /><path d="M10 32h36q-4 8-18 8T10 32z" fill="#7fae7a" /></svg>
      </div>
    </div>
    <svg v-if="has('hornbill')" class="fd-fly" width="110" height="60" viewBox="0 0 110 60"><path d="M30 34q20-26 40-6q-20-4-40 6z" fill="#1f2d27" /><path d="M70 30q14-2 22 4l-8 4q-6-2-14-2z" fill="#f2a93b" /><path d="M70 24q8-8 16-4l-6 6z" fill="#d1342a" /><path d="M30 34q-16 4-28 0q12-6 28-6z" fill="#f4f1ea" /></svg>
    <svg v-if="has('pumpkins')" class="fd-bats" width="220" height="60" viewBox="0 0 300 80"><path d="M20 30q10-14 20 0q10-14 20 0l-20 10z M220 20q10-14 20 0q10-14 20 0l-20 10z M130 60q8-11 16 0q8-11 16 0l-16 8z" fill="#2b2238" /></svg>

    <!-- along the bottom -->
    <div class="fd-ground">
      <svg v-if="has('snowman')" width="80" height="100" viewBox="0 0 96 120"><circle cx="48" cy="86" r="30" fill="#fff" stroke="#d5e1e8" stroke-width="2" /><circle cx="48" cy="40" r="21" fill="#fff" stroke="#d5e1e8" stroke-width="2" /><circle cx="41" cy="36" r="2.6" fill="#1f2d27" /><circle cx="55" cy="36" r="2.6" fill="#1f2d27" /><path d="M48 42l10 3l-10 2z" fill="#e8823a" /><path d="M30 54q18 8 36 0l-2 7q-16 6-32 0z" fill="#c0392b" /><path d="M30 22h36l-4-14h-28z" fill="#1f2d27" /><rect x="26" y="20" width="44" height="5" rx="2" fill="#1f2d27" /></svg>
      <svg v-if="has('pumpkins')" width="70" height="56" viewBox="0 0 70 60"><ellipse cx="35" cy="36" rx="32" ry="22" fill="#e8823a" /><path d="M35 14v-8" stroke="#3d6b45" stroke-width="5" stroke-linecap="round" /><path d="M20 30l6 6l-8 2zM50 30l-6 6l8 2zM22 46q13 8 26 0l-4 4l-4-4l-5 5l-5-5l-4 4z" fill="#2b2238" /></svg>
      <svg v-if="has('oranges')" width="90" height="50" viewBox="0 0 100 56"><circle cx="28" cy="34" r="20" fill="#f08a24" /><circle cx="68" cy="34" r="20" fill="#f39a3a" /><path d="M28 14q6-8 12-6q-4 6-12 6zM68 14q6-8 12-6q-4 6-12 6z" fill="#3d8a4a" /></svg>
      <template v-if="has('pelita') || has('diyas')"><svg v-for="i in 3" :key="'d' + i" width="36" height="34" viewBox="0 0 44 40"><path d="M22 2q7 9 0 16q-7-7 0-16z" fill="#f7a531" class="fd-flicker" /><path d="M4 22h36q-4 16-18 16T4 22z" :fill="has('diyas') ? '#c0612b' : '#5f8d4e'" /></svg></template>
      <template v-if="has('hibiscus')"><svg v-for="i in 2" :key="'b' + i" width="44" height="44" viewBox="0 0 56 56"><g fill="#d7263d"><ellipse cx="28" cy="14" rx="10" ry="13" /><ellipse cx="42" cy="26" rx="10" ry="13" transform="rotate(72 42 26)" /><ellipse cx="37" cy="43" rx="10" ry="13" transform="rotate(144 37 43)" /><ellipse cx="19" cy="43" rx="10" ry="13" transform="rotate(216 19 43)" /><ellipse cx="14" cy="26" rx="10" ry="13" transform="rotate(288 14 26)" /></g><circle cx="28" cy="29" r="5" fill="#f2c94c" /></svg></template>
      <template v-if="has('paddy')"><svg v-for="i in 4" :key="'p' + i" class="fd-sway" :style="{ animationDuration: 3 + i * 0.3 + 's' }" width="26" height="90" viewBox="0 0 34 120"><path d="M17 120Q15 70 22 20" stroke="#6f8f3a" stroke-width="3" fill="none" /><g fill="#d9b44a"><ellipse cx="24" cy="18" rx="4" ry="7" /><ellipse cx="27" cy="30" rx="4" ry="7" /><ellipse cx="18" cy="28" rx="4" ry="7" /><ellipse cx="26" cy="42" rx="4" ry="7" /></g></svg></template>
      <svg v-if="has('tree')" width="70" height="120" viewBox="0 0 80 140"><path d="M40 6l30 48h-14l22 36h-16l18 30H2l18-30H4l22-36H10z" fill="#3d6b45" /><rect x="34" y="120" width="12" height="16" fill="#7a5a3a" /><circle cx="30" cy="60" r="4" fill="#e8823a" /><circle cx="50" cy="84" r="4" fill="#c0392b" /><circle cx="28" cy="104" r="4" fill="#f2c94c" /><path d="M40 0l3 6h6l-5 4l2 6l-6-4l-6 4l2-6l-5-4h6z" fill="#f2c94c" /></svg>
    </div>
    <div v-if="has('snow')" class="fd-snowbank" />
  </div>
</template>

<style scoped>
.festive-decor { --top: 56px; --bottom: 0px; }
.fixed.festive-decor { --bottom: 0px; }
@media (max-width: 639px) { .fixed.festive-decor { --bottom: calc(66px + env(safe-area-inset-bottom)); } }
.absolute.festive-decor { --top: 0px; --bottom: 0px; }

.fd-fall { position: absolute; top: -20px; animation: fd-fall linear infinite; }
.fd-snow { border-radius: 9999px; background: #fff; box-shadow: 0 0 2px rgb(120 150 170 / 0.7); opacity: 0.9; }
.fd-confetti { width: 7px; height: 11px; border-radius: 2px; opacity: 0.85; }
.fd-rain { width: 2px; height: 14px; border-radius: 2px; background: #6f8fa8; opacity: 0.4; }
@keyframes fd-fall { to { transform: translateY(110vh); } }
.absolute .fd-fall { animation-name: fd-fall-box; }
@keyframes fd-fall-box { to { transform: translateY(700px); } }
.fd-heart { position: absolute; bottom: var(--bottom); opacity: 0; animation: fd-float ease-in infinite; }
@keyframes fd-float { 0% { transform: translateY(0) scale(0.8); opacity: 0; } 15% { opacity: 0.9; } 100% { transform: translateY(-80vh) scale(1.1); opacity: 0; } }
.absolute .fd-heart { animation-name: fd-float-box; }
@keyframes fd-float-box { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 0.9; } 100% { transform: translateY(-360px); opacity: 0; } }
.fd-star { position: absolute; width: 4px; height: 4px; border-radius: 9999px; background: #f2c94c; animation: fd-twinkle ease-in-out infinite; }
@keyframes fd-twinkle { 50% { opacity: 0.2; } }
.fd-burst { position: absolute; animation: fd-burst 1.8s ease-out infinite; }
@keyframes fd-burst { 0% { transform: scale(0.1); opacity: 1; } 70% { opacity: 1; } 100% { transform: scale(1.25); opacity: 0; } }
.fd-top-band { position: absolute; left: 0; top: var(--top); width: 100%; height: 60px; }
.fd-hang-row { position: absolute; inset: var(--top) 0 auto 0; }
.fd-hang { position: absolute; top: 0; display: flex; flex-direction: column; align-items: center; transform-origin: top center; animation: fd-sway 3.4s ease-in-out infinite; }
.fd-string { width: 2px; background: #8a6a2f; }
.fd-sway { transform-origin: bottom center; animation: fd-sway 3s ease-in-out infinite; }
@keyframes fd-sway { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
.fd-glow { animation: fd-twinkle 2s ease-in-out infinite; }
.fd-flicker { transform-origin: center bottom; animation: fd-flicker 1.1s ease-in-out infinite; }
@keyframes fd-flicker { 50% { transform: scaleY(0.82); opacity: 0.8; } }
.fd-fly { position: absolute; top: calc(var(--top) + 60px); left: 0; animation: fd-fly 14s linear infinite; }
@keyframes fd-fly { from { transform: translateX(-130px); } to { transform: translateX(110vw); } }
/* top decorations stay on the right, away from page titles (which sit on the left) */
.fd-bats { position: absolute; top: calc(var(--top) + 12px); right: 24%; animation: fd-bob 3s ease-in-out infinite; }
@keyframes fd-bob { 50% { transform: translateY(-8px); } }
/* ground decorations sit bottom right: bottom left is under the sidebar on a computer */
.fd-ground { position: absolute; left: 0; right: 0; bottom: var(--bottom); display: flex; align-items: flex-end; justify-content: flex-end; gap: 6px; padding: 0 12px 6px; }
/* behind the app the decorations are a little softer, so text in front of them stays easy to read */
.fixed.festive-decor { opacity: 0.8; }
.fd-snowbank { position: absolute; left: 0; right: 0; bottom: var(--bottom); height: 18px; background: #fff; border-radius: 60% 40% 0 0 / 18px 14px 0 0; opacity: 0.9; }
.dark .fd-snowbank { opacity: 0.35; }
.fd-flash { position: absolute; inset: 0; background: #fff; opacity: 0; animation: fd-flash 9s linear infinite; }
@keyframes fd-flash { 0%, 92%, 96%, 100% { opacity: 0; } 93% { opacity: 0.14; } 94.5% { opacity: 0.04; } 95% { opacity: 0.1; } }
.fd-bolt { position: absolute; right: 6%; top: calc(var(--top) + 24px); opacity: 0.85; animation: fd-bolt 9s linear infinite; }
@keyframes fd-bolt { 0%, 91%, 97%, 100% { opacity: 0.25; } 93%, 95% { opacity: 0.95; } }
.reduce-motion .fd-flash { display: none; }
@media (prefers-reduced-motion: reduce) { .fd-flash { display: none; } }
/* Reduce motion: nothing moves, but the snow, rain and hearts still sit on the screen */
.reduce-motion .fd-fall { top: var(--y); }
.reduce-motion .fd-heart { opacity: 0.8; bottom: auto; top: var(--y); }
@media (prefers-reduced-motion: reduce) { .fd-fall { top: var(--y); } .fd-heart { opacity: 0.8; bottom: auto; top: var(--y); } }
</style>
