<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Leaf } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { DEPARTMENTS } from '@/utils/constants'
import CatPeek from '@/components/CatPeek.vue'

const auth = useAuthStore()
const router = useRouter()
const mode = ref('login')
const form = ref({ name: '', departmentId: 'operation', email: '', password: '' })
const busy = ref(false)
const error = ref('')

const friendly = (e) => ({
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'This email already has an account. Try signing in.',
  'auth/weak-password': 'Use a password with at least 6 characters.',
  'auth/invalid-email': 'Enter a valid email address.',
}[e.code] ?? 'Something went wrong. Please try again.')

async function submit() {
  busy.value = true
  error.value = ''
  try {
    const f = form.value
    if (mode.value === 'login') await auth.login(f.email, f.password)
    else await auth.register(f.name.trim(), f.departmentId, f.email, f.password)
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
      <h2 class="text-base font-bold">{{ mode === 'login' ? 'Sign in' : 'Create your account' }}</h2>

      <div class="mt-4 space-y-3">
        <template v-if="mode === 'register'">
          <div><label class="label" for="name">Full name</label><input id="name" v-model="form.name" class="input" required /></div>
          <div>
            <label class="label" for="dept">Department</label>
            <select id="dept" v-model="form.departmentId" class="input">
              <option v-for="d in DEPARTMENTS" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </div>
        </template>
        <div><label class="label" for="email">Email</label><input id="email" v-model="form.email" type="email" class="input" autocomplete="email" required /></div>
        <div><label class="label" for="pw">Password</label><input id="pw" v-model="form.password" type="password" class="input" autocomplete="current-password" required /></div>
      </div>

      <p v-if="error" class="mt-3 text-sm font-semibold text-red-600" role="alert">{{ error }}</p>
      <button class="btn-primary mt-5 w-full" :disabled="busy">{{ busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account' }}</button>
      <button type="button" class="mt-3 w-full text-sm font-semibold text-accent" @click="mode = mode === 'login' ? 'register' : 'login'; error = ''">
        {{ mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in' }}
      </button>
    </form>
  </div>
</template>
