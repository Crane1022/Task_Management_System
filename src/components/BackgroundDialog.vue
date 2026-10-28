<script setup>
import { onMounted, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'
import AppearanceEditor from './AppearanceEditor.vue'

defineProps({ dashboardId: String })
const emit = defineEmits(['close'])
const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" @click.self="emit('close')">
    <div class="my-4 w-full max-w-5xl rounded-2xl bg-bg p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="Colours and background">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-base font-extrabold">Colours and background</h2>
        <button class="rounded p-1 text-muted hover:bg-surface" aria-label="Close" @click="emit('close')"><X class="h-5 w-5" /></button>
      </div>
      <AppearanceEditor :context="{ dashboardId, pageKey: 'dashboard' }" initial-scope="dashboard" />
    </div>
  </div>
</template>
