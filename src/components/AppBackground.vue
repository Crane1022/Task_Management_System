<script setup>
import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { bgImageStyle } from '@/utils/backgrounds'

// Sits behind the whole app. The overlay is the page background colour, so text stays readable on any image.
const theme = useThemeStore()
const bg = computed(() => theme.effective.background)
const image = computed(() => bgImageStyle(bg.value, theme.bgUrl))
</script>

<template>
  <div v-if="theme.bgUrl" class="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
    <div class="absolute inset-0" :style="image" />
    <div class="absolute inset-0 bg-bg" :style="{ opacity: bg?.overlay ?? 0.35 }" />
  </div>
</template>
