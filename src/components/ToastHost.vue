<script setup>
import { Undo2 } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'
const ui = useUiStore()
</script>

<template>
  <!-- just below the top bar, under the profile on the right, so a message never covers the buttons at the bottom; it ignores clicks so it never blocks a button under it -->
  <div class="pointer-events-none fixed right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col items-end gap-2" style="top: calc(3.5rem + 0.5rem + env(safe-area-inset-top, 0px))" aria-live="polite">
    <TransitionGroup name="toast">
    <div
      v-for="t in ui.toasts" :key="t.id"
      class="pointer-events-none max-w-full rounded-lg px-4 py-2.5 text-sm font-semibold shadow-lg"
      :class="t.type === 'error' ? 'bg-red-600 text-white' : 'bg-ink text-bg'"
    >{{ t.message }}</div>
    </TransitionGroup>
  </div>
  <!-- Undo (26 Nov 2026): bottom centre (above the phone's bottom bar), with a bar that shrinks until the delete really happens -->
  <div class="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:w-[420px] sm:-translate-x-1/2" aria-live="polite">
    <TransitionGroup name="undo">
      <div v-for="u in ui.undos" :key="u.id" role="status" class="pointer-events-auto w-full overflow-hidden rounded-xl bg-ink text-bg shadow-2xl">
        <div class="flex items-center gap-3 py-2 pl-4 pr-2">
          <span class="min-w-0 flex-1 text-sm font-bold">{{ u.message }}</span>
          <button type="button" class="press flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-highlight px-3 text-sm font-extrabold text-ink" @click="u.undo()"><Undo2 class="h-4 w-4" />Undo</button>
        </div>
        <div class="undo-bar h-[3px] bg-highlight" :style="{ animationDuration: u.ms + 'ms' }" />
      </div>
    </TransitionGroup>
  </div>
</template>

