<script setup>
import { ref, computed } from 'vue'
import { Leaf, Plus, Search, PawPrint, X } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { displayOf } from '@/utils/constants'

// First-time tour (26 Nov 2026): six short steps for new staff, each with a small moving picture of what it explains.
// It opens once per person on each device; Profile & settings has "Show the welcome tour again".
// The box never changes size between steps: the picture has a fixed height and every step's text is laid in the same
// place (only the current one is visible), so the box is always as tall as the longest step.
const ui = useUiStore()
const auth = useAuthStore()
const STEPS = [
  { title: 'Welcome to Widebed Tasks', text: 'Here is a one-minute look at where everything is. You can skip it and open it again any time from Profile & settings.' },
  { title: 'Your board', text: 'Each column is a stage of the work. When a job moves on, drag its card to the next column, and everyone sees it straight away. On a phone, use the Move button on the card.' },
  { title: 'Add a task', text: 'Press New task (or the + button on your phone). Give it a title, a deadline and the person who will do it. Everything else is optional.' },
  { title: 'Find anything', text: 'The search box finds people, tasks, comments and attached files. Type a colleague’s name to see everything they are working on.' },
  { title: 'Deadlines on a calendar', text: 'Open Calendar to see what is due each day. Drag a task to another day to move its deadline.' },
  { title: 'Meet your companion', text: 'Your little pet cheers you on and dresses up for festivals. Change it, or switch it off, in My companion.' },
]
const i = ref(0)
const dir = ref('next')
const last = computed(() => i.value === STEPS.length - 1)
const go = (n) => { dir.value = n > i.value ? 'next' : 'prev'; i.value = n }
function close() {
  ui.tourOpen = false
  try { localStorage.setItem(`wb-tour-done-${auth.user?.uid}`, '1') } catch { /* private browsing: it may show again */ }
  i.value = 0
}
const first = computed(() => displayOf(auth.profile).split(' ')[0])

// step 4: an example of searching a colleague's name (a picture only; nothing is really searched)
const query = 'neo'
const searchRows = [
  { kind: 'Person', cls: 'bg-accent-soft text-accent', text: 'Neo Ka Hoong · 4 open tasks' },
  { kind: 'Task', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200', text: 'Room planner: wall split · Neo' },
  { kind: 'Comment', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200', text: 'Neo: the wall split is done…' },
]
// step 5: a small month with a few deadlines
const miniCal = Array.from({ length: 28 }, (_, k) => ({ d: k + 1, dot: { 3: 'bg-amber-500', 9: 'bg-blue-600', 12: 'bg-amber-500', 16: 'bg-blue-600', 20: 'bg-red-600', 26: 'bg-white', 27: 'bg-amber-500' }[k + 1] ?? '' }))
</script>

<template>
  <Transition name="glass">
    <div v-if="ui.tourOpen" class="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" @keydown.esc="close">
      <div class="glass-scrim" @click="close" />
      <section role="dialog" aria-modal="true" aria-labelledby="tour-title" class="glass-panel relative w-full max-w-lg overflow-hidden rounded-b-none bg-surface sm:rounded-b-[22px]">
        <!-- the moving picture: always the same height -->
        <div class="tour-art relative h-60 overflow-hidden bg-accent-soft sm:h-64">
          <Transition :name="`month-${dir}`" mode="out-in">
            <div :key="i" class="absolute inset-0 grid place-items-center pt-8">

              <div v-if="i === 0" class="flex flex-col items-center gap-3">
                <span class="tour-ring grid h-20 w-20 place-items-center rounded-3xl bg-accent text-on-primary shadow-lg"><Leaf class="h-10 w-10" /></span>
                <span class="tour-rise text-base font-extrabold text-accent" style="--d: .25s">Hi {{ first }}!</span>
              </div>

              <div v-else-if="i === 1" class="relative grid w-72 grid-cols-2 gap-2.5">
                <div class="h-32 rounded-xl bg-surface p-2.5"><span class="text-[11px] font-extrabold text-muted">TODO</span></div>
                <div class="flex h-32 flex-col gap-1.5 rounded-xl bg-surface p-2.5"><span class="text-[11px] font-extrabold text-muted">DOING</span><div class="h-9 rounded-lg border-2 border-dashed border-line" /></div>
                <div class="tour-drag absolute left-2.5 top-8 flex h-9 w-32 items-center rounded-lg border border-line bg-surface px-2 text-xs font-extrabold shadow-xl">Quotation PDF</div>
              </div>

              <div v-else-if="i === 2" class="flex flex-col items-center gap-3">
                <span class="tour-ring flex h-11 items-center gap-2 rounded-xl bg-accent px-4 text-[15px] font-extrabold text-on-primary"><Plus class="h-4 w-4" />New task</span>
                <div class="tour-rise flex w-60 flex-col gap-1.5 rounded-xl bg-surface p-3 shadow-md" style="--d: .35s">
                  <span class="h-2.5 w-3/4 rounded bg-ink/80" /><span class="h-2 w-1/2 rounded bg-line" /><span class="mt-1 h-6 w-20 self-end rounded-md bg-accent" />
                </div>
              </div>

              <div v-else-if="i === 3" class="flex w-80 flex-col gap-2">
                <div class="flex h-11 items-center gap-2 rounded-xl bg-surface px-3 text-[15px] font-bold shadow-sm"><Search class="h-4 w-4 text-accent" /><span class="tour-type overflow-hidden whitespace-nowrap border-r-2 border-accent pr-0.5" :style="{ '--n': query.length }">{{ query }}</span></div>
                <div v-for="(r, k) in searchRows" :key="k" class="tour-rise flex h-9 items-center gap-2 rounded-lg bg-surface px-2.5 text-xs font-bold" :style="{ '--d': `${0.9 + k * 0.15}s` }">
                  <span class="shrink-0 rounded-md px-1.5 py-px text-[10px] font-extrabold" :class="r.cls">{{ r.kind }}</span><span class="truncate">{{ r.text }}</span>
                </div>
              </div>

              <div v-else-if="i === 4" class="grid w-72 grid-cols-7 gap-1 rounded-2xl bg-surface p-3">
                <span v-for="c in miniCal" :key="c.d" class="tour-pop flex h-8 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-extrabold" :class="c.d === 26 ? 'bg-accent text-on-primary' : ''" :style="{ '--d': `${c.d * 0.015}s` }">{{ c.d }}<span class="h-1 w-1 rounded-full" :class="c.dot" /></span>
              </div>

              <div v-else class="flex flex-col items-center gap-3">
                <div class="tour-pop rounded-2xl rounded-bl-sm bg-surface px-4 py-2.5 text-sm font-extrabold shadow-sm" style="--d: .3s">Good morning, {{ first }}! Let’s do this.</div>
                <span class="tour-bob grid h-20 w-20 place-items-center rounded-full bg-[#c9a27a] text-white shadow-lg"><PawPrint class="h-10 w-10" /></span>
              </div>

            </div>
          </Transition>
          <button type="button" class="press absolute right-3 top-3 z-10 flex h-9 items-center gap-1 rounded-full bg-surface/90 px-3 text-xs font-extrabold text-muted" @click="close"><X class="h-3.5 w-3.5" />Skip tour</button>
        </div>

        <div class="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-7">
          <p class="text-xs font-extrabold uppercase tracking-wide text-accent">Step {{ i + 1 }} of {{ STEPS.length }}</p>
          <!-- every step's text sits in the same grid cell; only the current one shows, so the height never jumps -->
          <div class="mt-1 grid">
            <div v-for="(s, k) in STEPS" :key="k" class="tour-step [grid-area:1/1]" :class="k === i ? `is-on from-${dir}` : 'is-off'" :aria-hidden="k !== i">
              <h2 :id="k === i ? 'tour-title' : undefined" class="text-xl font-extrabold">{{ s.title }}</h2>
              <p class="mt-1.5 text-[15px] leading-relaxed text-muted">{{ s.text }}</p>
            </div>
          </div>
          <div class="mt-5 flex items-center gap-2">
            <div class="flex flex-1 gap-1.5" aria-hidden="true">
              <span v-for="(s, k) in STEPS" :key="k" class="h-2 rounded-full transition-all duration-300" :class="[k === i ? 'w-6' : 'w-2', k <= i ? 'bg-accent' : 'bg-line']" />
            </div>
            <!-- Back keeps its space on step 1 too, so Next does not shift -->
            <button type="button" class="btn-ghost press" :class="i === 0 && 'invisible'" :tabindex="i === 0 ? -1 : 0" @click="go(i - 1)">Back</button>
            <button type="button" class="btn-primary press min-w-[9.5rem] justify-center" @click="last ? close() : go(i + 1)">{{ last ? 'Start using TMS' : 'Next' }}</button>
          </div>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
/* the step text: the current one slides in from the side it comes from; the others stay in place, invisible */
.tour-step { transition: opacity calc(.3s * var(--motion, 1)) ease, transform calc(.34s * var(--motion, 1)) cubic-bezier(.22, 1, .36, 1); }
.tour-step.is-off { opacity: 0; visibility: hidden; transform: translateX(-16px); transition: none; }
.tour-step.is-on { animation: step-in calc(.34s * var(--motion, 1)) cubic-bezier(.22, 1, .36, 1) both; }
.tour-step.is-on.from-prev { animation-name: step-in-back; }
@keyframes step-in { from { opacity: 0; transform: translateX(24px); } }
@keyframes step-in-back { from { opacity: 0; transform: translateX(-24px); } }

/* the pictures */
.tour-ring { animation: ring calc(1.8s * var(--motion, 1)) ease-out infinite; }
@keyframes ring { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent); } 100% { box-shadow: 0 0 0 16px transparent; } }
.tour-rise { animation: rise calc(.45s * var(--motion, 1)) cubic-bezier(.22, 1, .36, 1) both; animation-delay: calc(var(--d, 0s) * var(--motion, 1)); }
@keyframes rise { from { opacity: 0; transform: translateY(10px); } }
.tour-pop { animation: pop calc(.35s * var(--motion, 1)) cubic-bezier(.34, 1.42, .64, 1) both; animation-delay: calc(var(--d, 0s) * var(--motion, 1)); }
@keyframes pop { from { opacity: 0; transform: scale(.6); } }
/* a card is picked up, carried to the next column and put down, again and again */
.tour-drag { animation: drag calc(2.6s * var(--motion, 1)) cubic-bezier(.22, 1, .36, 1) .4s infinite; }
@keyframes drag {
  0%, 12% { transform: none; }
  30% { transform: translate(14px, -8px) rotate(3deg); }
  62% { transform: translate(148px, -8px) rotate(3deg); }
  75%, 100% { transform: translate(148px, 2px); }
}
/* the name is typed letter by letter, with a blinking cursor */
.tour-type { width: calc(var(--n) * 1ch + 2px); animation: type calc(.7s * var(--motion, 1)) steps(var(--n)) .2s both, caret 1s step-end infinite; }
@keyframes type { from { width: 0; } }
@keyframes caret { 50% { border-color: transparent; } }
/* the pet bobs gently */
.tour-bob { animation: bob calc(2.2s * var(--motion, 1)) ease-in-out infinite; }
@keyframes bob { 50% { transform: translateY(-6px); } }
</style>
