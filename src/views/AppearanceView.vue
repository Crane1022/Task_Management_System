<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'
import AppearanceEditor from '@/components/AppearanceEditor.vue'

// The editor needs the list of dashboards for the "specific dashboard" choice
const dash = useDashboardStore()
onMounted(() => dash.start())
onUnmounted(() => dash.stop())
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto max-w-6xl px-4 pb-10 pt-4">
      <h1 class="text-lg font-extrabold">Appearance &amp; Theme</h1>
      <p class="mt-1 text-sm text-muted">Pick a theme, adjust colours, size and corners, and add a background. Choose whether it applies everywhere, to one dashboard, or to one page.</p>
      <AppearanceEditor class="mt-4" />
    </div>
  </div>
</template>
