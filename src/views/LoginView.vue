<script setup>
import PasswordInput from '@/components/PasswordInput.vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Leaf } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import CatPeek from '@/components/CatPeek.vue'

// Sign in with the Widebed PMS account. There is no sign-up here: accounts are made on the PMS Staff accounts page.
const auth = useAuthStore()
const router = useRouter()
const form = ref({ email: '', password: '' })
const busy = ref(false)
const error = ref('')

const friendly = (e) => ({
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/user-disabled': 'This PMS account is disabled. Ask a Director.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'bridge/refused': 'Your PMS account is switched off or has no role. Ask a Director.',
  'bridge/offline': 'The task system could not be reached. Check your connection and try again.',
  'bridge/failed': 'Signed in to the PMS, but the task system could not finish signing you in. Please try again.',
}[e.code] ?? 'Something went wrong. Please try again.')

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await auth.login(form.value.email.trim(), form.value.password)
    router.push('/')
  } catch (e) {
    error.value = friendly(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="grid min-h-screen place-items-center p-4">
    <form class="relative mt-8 w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-card" @submit.prevent="submit">
      <CatPeek variant="orange" />
      <div class="mb-5 flex items-center gap-2">
        <div class="grid h-9 w-9 place-items-center rounded-lg bg-accent font-extrabold text-on-primary"><Leaf class="h-5 w-5" /></div>
        <h1 class="text-lg font-extrabold">Widebed Tasks</h1>
      </div>
      <h2 class="text-base font-bold">Sign in</h2>
      <p class="mt-1 text-sm text-muted">Use your Widebed PMS email and password.</p>

      <div class="mt-4 space-y-3">
        <div><label class="label" for="email">Email</label><input id="email" v-model="form.email" type="email" class="input" autocomplete="email" required /></div>
        <div><label class="label" for="pw">Password</label><PasswordInput id="pw" v-model="form.password" autocomplete="current-password" required /></div>
      </div>

      <p v-if="error" class="mt-3 text-sm font-semibold text-red-600" role="alert">{{ error }}</p>
      <button class="btn-primary mt-5 w-full" :disabled="busy">{{ busy ? 'Please wait…' : 'Sign in' }}</button>
      <p class="mt-3 text-center text-xs text-muted">No account? Ask a Director to add you on the PMS Staff accounts page.</p>
    </form>
  </div>
</template>
