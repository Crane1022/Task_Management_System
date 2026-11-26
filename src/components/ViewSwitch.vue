<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

// Phone (26 Nov 2026): List and Calendar share the List tab of the bottom bar; this switch moves between them.
const route = useRoute()
const onCalendar = computed(() => route.name === 'calendar')
</script>

<template>
  <nav aria-label="Show tasks as" class="relative grid h-11 grid-cols-2 rounded-xl bg-line/60 p-[3px]">
    <span aria-hidden="true" class="seg-pill absolute left-[3px] top-[3px] h-[38px] w-[calc(50%-3px)] rounded-[10px] bg-surface shadow-sm" :style="{ transform: onCalendar ? 'translateX(100%)' : 'none' }" />
    <router-link to="/list" class="relative grid place-items-center text-sm font-extrabold" :class="onCalendar ? 'text-muted' : 'text-ink'" :aria-current="onCalendar ? null : 'page'">List</router-link>
    <router-link to="/calendar" class="relative grid place-items-center text-sm font-extrabold" :class="onCalendar ? 'text-ink' : 'text-muted'" :aria-current="onCalendar ? 'page' : null">Calendar</router-link>
  </nav>
</template>
