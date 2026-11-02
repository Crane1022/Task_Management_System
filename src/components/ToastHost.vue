<script setup>
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
</template>
