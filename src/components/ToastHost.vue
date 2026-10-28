<script setup>
import { useUiStore } from '@/stores/ui'
const ui = useUiStore()
</script>

<template>
  <div class="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2" aria-live="polite">
    <div
      v-for="t in ui.toasts" :key="t.id"
      class="pointer-events-auto max-w-sm rounded-lg px-4 py-2.5 text-sm font-semibold shadow-lg"
      :class="t.type === 'error' ? 'bg-red-600 text-white' : 'bg-ink text-bg'"
    >{{ t.message }}</div>
  </div>
</template>
