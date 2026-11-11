<script setup>
// Four paw prints that appear one after another, like a cat walking past, with a short message under them.
//   <PawLoader text="Loading comments…" />        <PawLoader text="Loading…" small />
// With Reduce motion on (yours or the system's) the paws just sit still.
import { PawPrint } from 'lucide-vue-next'
defineProps({ text: { type: String, default: 'Loading…' }, small: { type: Boolean, default: false } })
</script>

<template>
  <div class="paw-loader flex flex-col items-center gap-1.5 text-muted" :class="small ? 'py-2' : 'py-6'" role="status">
    <div class="flex items-end gap-1 text-accent" aria-hidden="true">
      <PawPrint v-for="i in 4" :key="i" class="paw" :class="small ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]'" :style="{ animationDelay: `${(i - 1) * 0.2}s`, marginBottom: i % 2 ? '0' : '6px' }" />
    </div>
    <span :class="small ? 'text-xs' : 'text-sm'">{{ text }}</span>
  </div>
</template>

<style scoped>
.paw { opacity: 0; animation: paw-step 1.6s infinite; transform-origin: center; }
@keyframes paw-step { 0%, 100% { opacity: 0; transform: scale(0.6) rotate(-8deg); } 25%, 60% { opacity: 1; transform: scale(1) rotate(0); } }
@media (prefers-reduced-motion: reduce) { .paw { opacity: 1; animation: none; } }
:global(.reduce-motion) .paw { opacity: 1; }
</style>
