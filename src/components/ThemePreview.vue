<script setup>
import CatPeek from './CatPeek.vue'
// A small stand-in for the app, scoped with its own CSS variables so nothing outside changes.
defineProps({ vars: Object, bgStyle: Object, overlay: { type: Number, default: 0 }, fontScale: { type: Number, default: 100 } })
</script>

<template>
  <div class="relative overflow-hidden rounded-2xl border border-line" :style="[vars, { background: 'var(--bg)', color: 'var(--ink)' }]">
    <div class="absolute inset-0" :style="bgStyle" />
    <div class="absolute inset-0" :style="{ background: 'var(--bg)', opacity: overlay }" />
    <div class="relative flex min-h-[230px] gap-3 p-3 pt-9">
      <div class="hidden w-12 shrink-0 flex-col gap-2 rounded-xl border border-line bg-surface p-2 sm:flex">
        <span class="h-6 rounded-lg bg-accent" /><span class="h-4 rounded-md bg-accent-soft" /><span class="h-4 rounded-md bg-accent-soft" />
      </div>
      <div class="relative min-w-0 flex-1 space-y-3">
        <div class="relative rounded-xl border border-line bg-surface p-3 shadow-card">
          <CatPeek variant="calico" />
          <p class="font-bold" :style="{ fontSize: (14 * fontScale) / 100 + 'px' }">Prepare Unit A101</p>
          <p class="mt-0.5 text-muted" :style="{ fontSize: (12 * fontScale) / 100 + 'px' }">Check keys, clean and test the aircond.</p>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <span class="rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">Operation</span>
            <span class="rounded-md border border-highlight px-2 py-0.5 text-[11px] font-bold">High</span>
            <button type="button" class="btn-primary px-2.5 py-1 text-xs" tabindex="-1">Save</button>
          </div>
        </div>
        <div class="rounded-xl border border-line bg-surface p-3 shadow-card">
          <div class="h-1.5 overflow-hidden rounded-full bg-line"><div class="h-full w-2/3 rounded-full bg-accent" /></div>
          <p class="mt-2 text-xs text-muted">3 of 5 completed</p>
        </div>
      </div>
    </div>
  </div>
</template>
