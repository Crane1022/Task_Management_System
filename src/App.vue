<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import AppTopbar from '@/components/AppTopbar.vue'
import ToastHost from '@/components/ToastHost.vue'
import AppBackground from '@/components/AppBackground.vue'
import { watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useWorkspaceStore } from '@/stores/workspace'
import { useCompanionStore } from '@/stores/companion'
import PetCompanion from '@/components/PetCompanion.vue'
import { setDisplayTimeZone } from '@/utils/dates'

const route = useRoute()
const bare = computed(() => route.meta.public)

// Load this person's saved appearance as soon as they are signed in
const auth = useAuthStore()
const theme = useThemeStore()
const workspaces = useWorkspaceStore()
const companion = useCompanionStore()
// each person's virtual pet loads (and is cleared) with them, so nobody sees someone else's
watch(() => auth.user, (u) => (u ? companion.start() : companion.stop()), { immediate: true })
watch(() => auth.user, (u) => (u ? theme.start() : theme.stop()), { immediate: true })
// Workspaces and boards follow the person (and restart if a Director changes their role, which changes what they may list)
watch(() => [auth.user, auth.isAdmin], ([u]) => (u ? workspaces.start() : workspaces.stop()), { immediate: true })

watch(() => auth.profile?.timezone, (tz) => setDisplayTimeZone(tz), { immediate: true })

// Signed out from elsewhere (the PMS account was switched off, or another tab signed out): back to the login page
const router = useRouter()
watch(() => auth.user, (u) => { if (!u && !route.meta.public) router.push('/login') })
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
  <PetCompanion v-if="!bare && auth.user" />
  <ToastHost />
</template>
