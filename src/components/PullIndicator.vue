<script setup>
// The arrow that turns as you pull down, then a spinner while reloading. Goes with composables/usePullToRefresh.js.
import { ArrowDown, LoaderCircle } from 'lucide-vue-next'
const props = defineProps({ pull: { type: Number, default: 0 }, busy: { type: Boolean, default: false }, threshold: { type: Number, default: 64 } })
</script>

<template>
  <div class="pull-ind flex items-end justify-center overflow-hidden text-accent" :style="{ height: pull + 'px' }" :aria-hidden="!busy" role="status">
    <span v-if="pull > 8 || busy" class="mb-2 grid h-8 w-8 place-items-center rounded-full border border-line bg-surface shadow-card">
      <LoaderCircle v-if="busy" class="h-4 w-4 animate-spin" />
      <ArrowDown v-else class="h-4 w-4 transition-transform" :style="{ transform: `rotate(${pull >= threshold ? 180 : 0}deg)` }" />
      <span class="sr-only">{{ busy ? 'Refreshing' : pull >= threshold ? 'Let go to refresh' : 'Pull to refresh' }}</span>
    </span>
  </div>
</template>

<style scoped>
.pull-ind { transition: height 0.25s var(--ease); }
</style>
