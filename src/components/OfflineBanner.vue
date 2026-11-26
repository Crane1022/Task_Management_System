<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { WifiOff, Check, Loader2 } from 'lucide-vue-next'
import { waitForPendingWrites } from '@/firebase/sdk'
import { db } from '@/firebase/config'

// Offline banner (26 Nov 2026). Without internet the app keeps working on the copy kept on this device; this says so,
// and when the connection comes back it waits until every change made meanwhile is saved, then says that too.
const state = ref(navigator.onLine ? 'online' : 'offline') // online | offline | syncing | synced
let timer = null
async function backOnline() {
  if (state.value === 'online') return
  state.value = 'syncing'
  try { await Promise.race([waitForPendingWrites(db), new Promise((r) => setTimeout(r, 15000))]) } catch { /* the banner still clears */ }
  if (!navigator.onLine) { state.value = 'offline'; return }
  state.value = 'synced'
  clearTimeout(timer)
  timer = setTimeout(() => { if (state.value === 'synced') state.value = 'online' }, 3000)
}
const goneOffline = () => { clearTimeout(timer); state.value = 'offline' }
const check = () => (navigator.onLine ? backOnline() : (state.value = 'offline'))
onMounted(() => { window.addEventListener('online', backOnline); window.addEventListener('offline', goneOffline) })
onUnmounted(() => { window.removeEventListener('online', backOnline); window.removeEventListener('offline', goneOffline); clearTimeout(timer) })
</script>

<template>
  <div class="collapsible shrink-0" :class="state !== 'online' && 'open'">
    <div class="min-h-0 overflow-hidden">
      <div role="status" class="flex items-center gap-2.5 border-b px-4 py-2 text-sm font-bold"
        :class="state === 'synced' ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100'">
        <Check v-if="state === 'synced'" class="tick-pop h-4 w-4 shrink-0" />
        <Loader2 v-else-if="state === 'syncing'" class="h-4 w-4 shrink-0 animate-spin" />
        <span v-else class="pulse-dot grid h-2.5 w-2.5 shrink-0 place-items-center rounded-full bg-amber-500 text-amber-500"><WifiOff class="sr-only" /></span>
        <Transition name="status-swap" mode="out-in">
          <span :key="state" class="min-w-0 flex-1">
            <template v-if="state === 'synced'">Back online. Your changes are saved.</template>
            <template v-else-if="state === 'syncing'">Back online. Saving the changes you made…</template>
            <template v-else><span class="sm:hidden">You’re offline. Changes will be saved when you’re back online.</span><span class="hidden sm:inline">You’re offline. You’re seeing the tasks saved on this device, and anything you change will be saved as soon as you’re back online.</span></template>
          </span>
        </Transition>
        <button v-if="state === 'offline'" type="button" class="press shrink-0 rounded-lg bg-surface px-3 py-1.5 text-xs font-extrabold text-amber-900 shadow-sm dark:text-amber-100" @click="check">Try again</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* slides open and closed by its height, like the sidebar's dropdowns */
.collapsible { display: grid; grid-template-rows: 0fr; transition: grid-template-rows calc(.3s * var(--motion, 1)) cubic-bezier(.22, 1, .36, 1); }
.collapsible.open { grid-template-rows: 1fr; }
</style>
