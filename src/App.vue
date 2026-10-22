<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import AppTopbar from '@/components/AppTopbar.vue'
import ToastHost from '@/components/ToastHost.vue'
import AppBackground from '@/components/AppBackground.vue'
import { watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

const route = useRoute()
const bare = computed(() => route.meta.public)

// Load this person's saved appearance as soon as they are signed in
const auth = useAuthStore()
const theme = useThemeStore()
watch(() => auth.user, (u) => (u ? theme.start() : theme.stop()), { immediate: true })
</script>

<template>
  <AppBackground />
  <router-view v-if="bare" />
  <div v-else class="flex h-screen overflow-hidden">
    <AppSidebar />
    <div class="flex min-w-0 flex-1 flex-col">
      <AppTopbar />
      <main class="min-h-0 flex-1 overflow-hidden"><router-view :key="route.fullPath" /></main>
    </div>
  </div>
  <ToastHost />
</template>
