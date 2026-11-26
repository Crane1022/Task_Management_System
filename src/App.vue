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
import BottomNav from '@/components/BottomNav.vue'
import TopProgress from '@/components/TopProgress.vue'
import PawLoader from '@/components/PawLoader.vue'
import { ref, defineAsyncComponent } from 'vue'
import OfflineBanner from '@/components/OfflineBanner.vue'
import { useUiStore } from '@/stores/ui'
// Faster first load (26 Nov 2026): the pet, the festive layer and the welcome tour are not needed to show the board,
// so their code is fetched just after the page appears instead of before it
const PetCompanion = defineAsyncComponent(() => import('@/components/PetCompanion.vue'))
const FestiveLayer = defineAsyncComponent(() => import('@/components/FestiveLayer.vue'))
const TourDialog = defineAsyncComponent(() => import('@/components/TourDialog.vue'))
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
// festive companion: festivals, Ramadan, time of day, weather, wardrobe (a Director's role change reloads which events they manage)
// (its code, with every festival's dates and greetings, loads just after the first page: 26 Nov 2026)
let festive = null
watch(() => [auth.user, auth.isAdmin], async ([u]) => {
  festive ??= (await import('@/stores/festive')).useFestiveStore()
  if (u) festive.start(); else festive.stop()
}, { immediate: true })
// Workspaces and boards follow the person (and restart if a Director changes their role, which changes what they may list)
watch(() => [auth.user, auth.isAdmin], ([u]) => (u ? workspaces.start() : workspaces.stop()), { immediate: true })

watch(() => auth.profile?.timezone, (tz) => setDisplayTimeZone(tz), { immediate: true })

// Signed out from elsewhere (the PMS account was switched off, or another tab signed out): back to the login page
const router = useRouter()
// until the first page is known (sign-in checked), a walking-paws screen instead of an empty one
const ready = ref(false)
router.isReady().then(() => (ready.value = true))
watch(() => auth.user, (u) => { if (!u && !route.meta.public) router.push('/login') })

// the welcome tour opens by itself the first time someone signs in on this device (26 Nov 2026)
const ui = useUiStore()
watch([() => auth.user, ready], ([u, r]) => {
  if (!u || !r || route.meta.public) return
  let seen = true
  try { seen = !!localStorage.getItem(`wb-tour-done-${u.uid}`) } catch { /* private browsing: skip */ }
  if (!seen) setTimeout(() => (ui.tourOpen = true), 900)
}, { immediate: true })
</script>

<template>
  <TopProgress />
  <AppBackground />
  <div v-if="!ready" class="grid h-screen place-items-center"><PawLoader text="Opening Widebed Tasks…" /></div>
  <router-view v-else-if="bare" />
  <div v-else class="flex h-[100dvh] overflow-hidden">
    <AppSidebar />
    <div class="flex min-w-0 flex-1 flex-col">
      <AppTopbar />
      <OfflineBanner />
      <!-- phone: room at the bottom for the bottom bar -->
      <!-- relative: hidden inputs (sr-only) inside the pages stay in here instead of stretching the whole page -->
      <main class="relative min-h-0 flex-1 overflow-hidden pb-[calc(66px+env(safe-area-inset-bottom))] sm:pb-0"><router-view :key="route.fullPath" /></main>
    </div>
  </div>
  <BottomNav v-if="ready && !bare && auth.user" />
  <PetCompanion v-if="ready && !bare && auth.user" />
  <FestiveLayer v-if="ready && !bare && auth.user" />
  <TourDialog v-if="ready && !bare && auth.user" />
  <ToastHost />
</template>
