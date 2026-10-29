<script setup>
import { ref, onMounted } from 'vue'
import { MonitorSmartphone } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { pushPossible, pushPermission, pushIsOn, enablePush, disablePush } from '@/services/pushService'

// "Desktop pop-ups" switch for THIS browser/computer. It only turns on when the person clicks it (browsers require that).
const auth = useAuthStore()
const ui = useUiStore()
const supported = pushPossible()
const on = ref(false)
const busy = ref(false)
const blocked = ref(pushPermission() === 'denied')
onMounted(async () => { if (supported) on.value = await pushIsOn(auth.user.uid) })

async function toggle() {
  if (busy.value) return
  busy.value = true
  try {
    if (on.value) { await disablePush(auth.user.uid); on.value = false; ui.toast('Desktop pop-ups are off on this computer') }
    else { await enablePush(auth.user.uid); on.value = true; blocked.value = false; ui.toast('Desktop pop-ups are on for this computer') }
  } catch (e) {
    blocked.value = pushPermission() === 'denied'
    ui.toast(e.message || 'Could not change desktop pop-ups', 'error')
  } finally { busy.value = false }
}
</script>

<template>
  <div v-if="supported" class="flex items-start gap-3 border-t border-line px-3 py-2.5">
    <MonitorSmartphone class="mt-0.5 h-4 w-4 shrink-0 text-muted" />
    <div class="min-w-0 flex-1">
      <p class="text-xs font-bold">Desktop pop-ups</p>
      <p class="text-[11px] text-muted">{{ blocked ? 'Blocked in this browser. Allow notifications for this site in the browser settings.' : 'Get a pop-up on this computer even when the app is closed.' }}</p>
    </div>
    <button type="button" role="switch" :aria-checked="on" :aria-label="on ? 'Turn off desktop pop-ups' : 'Turn on desktop pop-ups'" :disabled="busy"
      class="relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50" :class="on ? 'bg-accent' : 'bg-line'" @click="toggle">
      <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all" :class="on ? 'left-[1.1rem]' : 'left-0.5'" />
    </button>
  </div>
</template>
