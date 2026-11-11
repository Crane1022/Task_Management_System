<script setup>
// A grey stand-in shaped like a TaskCard (title, a line of description, tags, avatar) while a board loads.
// `n` changes the line widths a little so a column of them doesn't look stamped out.
defineProps({ n: { type: Number, default: 0 } })
const widths = ['82%', '64%', '90%', '72%']
</script>

<template>
  <div class="rounded-xl border border-line bg-surface p-3 shadow-card" aria-hidden="true">
    <span class="skeleton block h-3.5 rounded-md" :style="{ width: widths[n % 4] }" />
    <span class="skeleton mt-2 block h-2.5 rounded-md" :style="{ width: widths[(n + 2) % 4] }" />
    <div class="mt-3 flex gap-1.5"><span class="skeleton h-4 w-12 rounded-md" /><span class="skeleton h-4 w-16 rounded-md" /></div>
    <div class="mt-3 flex items-center justify-between">
      <span class="skeleton h-3 w-16 rounded-md" />
      <span class="skeleton h-6 w-6 rounded-full" />
    </div>
  </div>
</template>
