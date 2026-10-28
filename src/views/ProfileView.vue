<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Camera, Trash2, Palette, LogOut, ShieldCheck, Info } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useThemeStore } from '@/stores/theme'
import { pmsAuth } from '@/firebase/config'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail, deleteField } from '@/firebase/sdk'
import { updateOwnProfile, loadPreferences, savePreferences } from '@/services/userService'
import { validateImage } from '@/services/themeService'
import { squarePhoto, timeZones } from '@/utils/avatar'
import { deptName, displayOf } from '@/utils/constants'
import UserAvatar from '@/components/UserAvatar.vue'
import PasswordInput from '@/components/PasswordInput.vue'

// Profile and account settings. Staff sign in with their PMS account, so name and email come from the PMS;
// department, role, employee ID and job position are set by a Director (Staff page) and are read-only here.
const auth = useAuthStore()
const ui = useUiStore()
const theme = useThemeStore()
const router = useRouter()
const me = computed(() => auth.profile)
const roleLabel = { super_admin: 'Director', dept_manager: 'Department Manager', employee: 'Employee' }
const LANDING = [{ id: 'dashboard', name: 'Dashboard' }, { id: 'board', name: 'Kanban Board' }, { id: 'list', name: 'List' }, { id: 'my-tasks', name: 'My Tasks' }]
const zones = timeZones()
const fmt = (v) => { const d = v?.toDate ? v.toDate() : v ? new Date(v) : null; return d && !isNaN(d) ? d.toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not available' }

// ----- profile details -----
const form = ref({ displayName: '', timezone: '', landingPage: 'dashboard' })
watch(me, (p) => { if (p) form.value = { displayName: p.displayName ?? '', timezone: p.timezone ?? '', landingPage: p.landingPage ?? 'dashboard' } }, { immediate: true })
const savingProfile = ref(false)
const dirty = computed(() => me.value && (form.value.displayName !== (me.value.displayName ?? '') || form.value.timezone !== (me.value.timezone ?? '') || form.value.landingPage !== (me.value.landingPage ?? 'dashboard')))
async function saveProfile() {
  savingProfile.value = true
  try {
    await updateOwnProfile(auth.user.uid, { displayName: form.value.displayName.trim(), timezone: form.value.timezone, landingPage: form.value.landingPage })
    ui.toast('Profile saved')
  } catch (e) { console.error(e); ui.toast(`Could not save: ${e.code ?? e.message}`, 'error') }
  savingProfile.value = false
}

// ----- photo -----
const photoInput = ref(null)
const photoBusy = ref(false)
async function onPhoto(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  const problem = validateImage(file)
  if (problem) { ui.toast(problem, 'error'); return }
  photoBusy.value = true
  try { await updateOwnProfile(auth.user.uid, { photo: await squarePhoto(file) }); ui.toast('Photo updated') }
  catch (err) { ui.toast(err.message || 'Could not save the photo', 'error') }
  photoBusy.value = false
}
async function removePhoto() {
  photoBusy.value = true
  try { await updateOwnProfile(auth.user.uid, { photo: deleteField() }); ui.toast('Photo removed') }
  catch (err) { ui.toast(`Could not remove the photo: ${err.code ?? err.message}`, 'error') }
  photoBusy.value = false
}

// ----- password (the PMS account's password) -----
const pw = ref({ current: '', next: '', again: '' })
const pwBusy = ref(false)
const pwError = ref('')
const friendly = (e) => ({
  'auth/wrong-password': 'The current password is not correct.',
  'auth/invalid-credential': 'The current password is not correct.',
  'auth/weak-password': 'Choose a stronger password.',
  'auth/requires-recent-login': 'For safety, sign out, sign in again, and then change the password.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes.',
  'auth/network-request-failed': 'No connection. Please try again.',
}[e.code] ?? 'Could not change the password. Please try again.')
async function changePassword() {
  pwError.value = ''
  if (pw.value.next.length < 8) { pwError.value = 'Use at least 8 characters.'; return }
  if (pw.value.next !== pw.value.again) { pwError.value = 'The two new passwords are not the same.'; return }
  const u = pmsAuth.currentUser
  if (!u?.email) { pwError.value = 'You are not signed in to the PMS account.'; return }
  pwBusy.value = true
  try {
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, pw.value.current))
    await updatePassword(u, pw.value.next)
    pw.value = { current: '', next: '', again: '' }
    ui.toast('Password changed')
  } catch (e) { console.error(e); pwError.value = friendly(e) }
  pwBusy.value = false
}
async function sendReset() {
  try { await sendPasswordResetEmail(pmsAuth, me.value.email); ui.toast(`Reset link sent to ${me.value.email}`) }
  catch (e) { ui.toast(friendly(e), 'error') }
}

// ----- notification choices (saved now; delivery is not built yet) -----
const prefs = ref({ inApp: { assigned: true, deadlines: true, comments: true }, email: { assigned: false, deadlines: false } })
const prefsBusy = ref(false)
onMounted(async () => {
  try {
    const saved = await loadPreferences(auth.user.uid)
    prefs.value = { inApp: { ...prefs.value.inApp, ...saved.inApp }, email: { ...prefs.value.email, ...saved.email } }
  } catch { /* defaults are fine */ }
})
async function savePrefs() {
  prefsBusy.value = true
  try { await savePreferences(auth.user.uid, JSON.parse(JSON.stringify(prefs.value))); ui.toast('Notification choices saved') }
  catch (e) { ui.toast(`Could not save: ${e.code ?? e.message}`, 'error') }
  prefsBusy.value = false
}

// ----- appearance shortcuts -----
const reduceMotion = computed(() => !!theme.effective.reduceMotion)
const setReduceMotion = (on) => theme.saveGlobal({ ...theme.globalLayer, reduceMotion: on })

// ----- sign-in information -----
const info = computed(() => {
  const u = pmsAuth.currentUser
  return { email: u?.email ?? me.value?.email, verified: u?.emailVerified, created: u?.metadata?.creationTime, last: u?.metadata?.lastSignInTime, providers: (u?.providerData ?? []).map((p) => p.providerId).join(', ') || 'Email and password' }
})
async function signOut() { await auth.logout(); router.push('/login') }
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div v-if="me" class="mx-auto max-w-3xl space-y-5 px-4 pb-12 pt-4">
      <h1 class="text-lg font-extrabold">Profile and settings</h1>

      <section class="card">
        <h2 class="h">Profile</h2>
        <div class="flex flex-wrap items-center gap-4">
          <UserAvatar :user="me" :size="72" />
          <div class="space-y-2">
            <input ref="photoInput" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" @change="onPhoto" />
            <div class="flex gap-2">
              <button class="btn-ghost" :disabled="photoBusy" @click="photoInput.click()"><Camera class="h-4 w-4" />{{ me.photo ? 'Change photo' : 'Add photo' }}</button>
              <button v-if="me.photo" class="btn-ghost text-red-600" :disabled="photoBusy" @click="removePhoto"><Trash2 class="h-4 w-4" />Remove</button>
            </div>
            <p class="text-xs text-muted">JPG, PNG or WebP up to 5 MB. It is cropped to a small square.</p>
          </div>
        </div>

        <div class="mt-5 grid gap-3 sm:grid-cols-2">
          <div><label class="label" for="p-display">Display name</label><input id="p-display" v-model="form.displayName" class="input" maxlength="60" :placeholder="me.name" /><p class="mt-1 text-xs text-muted">Shown to your colleagues instead of your full name.</p></div>
          <div><label class="label" for="p-name">Full name</label><input id="p-name" class="input" :value="me.name" disabled /><p class="mt-1 text-xs text-muted">Comes from the PMS.</p></div>
          <div><label class="label" for="p-email">Email</label><input id="p-email" class="input" :value="me.email" disabled /></div>
          <div><label class="label" for="p-created">Account created</label><input id="p-created" class="input" :value="fmt(me.createdAt)" disabled /></div>
        </div>

        <div class="mt-5 rounded-xl bg-bg p-3">
          <p class="flex items-center gap-1.5 text-xs font-bold text-muted"><Info class="h-3.5 w-3.5" />Set by your company. Ask a Director to change these.</p>
          <dl class="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt class="text-xs text-muted">Department</dt><dd class="font-semibold">{{ deptName(me.departmentId) }}</dd></div>
            <div><dt class="text-xs text-muted">Role</dt><dd class="font-semibold">{{ roleLabel[me.role] }}</dd></div>
          </dl>
        </div>
      </section>

      <section class="card">
        <h2 class="h">Account preferences</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <div><label class="label" for="p-land">Open this page when I sign in</label>
            <select id="p-land" v-model="form.landingPage" class="input"><option v-for="l in LANDING" :key="l.id" :value="l.id">{{ l.name }}</option></select></div>
          <div><label class="label" for="p-tz">Time zone</label>
            <select id="p-tz" v-model="form.timezone" class="input"><option value="">Same as my device</option><option v-for="z in zones" :key="z" :value="z">{{ z }}</option></select>
            <p class="mt-1 text-xs text-muted">Used for times in the activity log. Deadlines are plain dates and do not move.</p></div>
        </div>
        <button class="btn-primary mt-4" :disabled="!dirty || savingProfile" @click="saveProfile">{{ savingProfile ? 'Saving…' : 'Save' }}</button>
        <p class="mt-3 text-xs text-muted">The app is in English only for now, so there is no language setting yet.</p>
      </section>

      <section class="card">
        <h2 class="h">Notifications</h2>
        <p class="mb-3 flex items-start gap-1.5 rounded-lg bg-bg p-2.5 text-xs text-muted"><Info class="mt-0.5 h-3.5 w-3.5 shrink-0" />Notifications are not sent yet. Your choices are saved now and will be used when they are added.</p>
        <div class="grid gap-4 sm:grid-cols-2">
          <fieldset><legend class="label">In the app</legend>
            <label class="chk"><input v-model="prefs.inApp.assigned" type="checkbox" />A task is assigned to me</label>
            <label class="chk"><input v-model="prefs.inApp.deadlines" type="checkbox" />A deadline is coming up or missed</label>
            <label class="chk"><input v-model="prefs.inApp.comments" type="checkbox" />Someone comments on my task</label></fieldset>
          <fieldset><legend class="label">By email</legend>
            <label class="chk"><input v-model="prefs.email.assigned" type="checkbox" />A task is assigned to me</label>
            <label class="chk"><input v-model="prefs.email.deadlines" type="checkbox" />A deadline is coming up or missed</label></fieldset>
        </div>
        <button class="btn-primary mt-4" :disabled="prefsBusy" @click="savePrefs">{{ prefsBusy ? 'Saving…' : 'Save choices' }}</button>
      </section>

      <section class="card">
        <h2 class="h">Appearance</h2>
        <div class="flex flex-wrap items-center gap-2">
          <router-link to="/settings/appearance" class="btn-ghost"><Palette class="h-4 w-4" />Theme, colours and backgrounds</router-link>
          <button class="btn-ghost" @click="theme.toggleDark()">{{ ui.dark ? 'Switch to light mode' : 'Switch to dark mode' }}</button>
        </div>
        <label class="chk mt-3"><input type="checkbox" :checked="reduceMotion" @change="setReduceMotion($event.target.checked)" />Reduce motion (switches off animations, including the cats)</label>
      </section>

      <section class="card">
        <h2 class="h">Password</h2>
        <p class="mb-3 text-xs text-muted">This is your Widebed PMS password. Changing it here changes it for the PMS too.</p>
        <form class="grid gap-3 sm:grid-cols-3" @submit.prevent="changePassword">
          <div><label class="label" for="pw-cur">Current password</label><PasswordInput id="pw-cur" v-model="pw.current" autocomplete="current-password" required /></div>
          <div><label class="label" for="pw-new">New password</label><PasswordInput id="pw-new" v-model="pw.next" autocomplete="new-password" minlength="8" required /></div>
          <div><label class="label" for="pw-again">New password again</label><PasswordInput id="pw-again" v-model="pw.again" autocomplete="new-password" required /></div>
          <div class="flex flex-wrap items-center gap-2 sm:col-span-3">
            <button class="btn-primary" :disabled="pwBusy">{{ pwBusy ? 'Changing…' : 'Change password' }}</button>
            <button type="button" class="btn-ghost" @click="sendReset">Email me a reset link instead</button>
          </div>
          <p v-if="pwError" class="text-sm font-semibold text-red-600 sm:col-span-3" role="alert">{{ pwError }}</p>
        </form>
      </section>

      <section class="card">
        <h2 class="h"><ShieldCheck class="mr-1 inline h-4 w-4" />Sign-in and privacy</h2>
        <dl class="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt class="text-xs text-muted">Signed in as</dt><dd class="font-semibold">{{ info.email }}</dd></div>
          <div><dt class="text-xs text-muted">Sign-in method</dt><dd class="font-semibold">{{ info.providers }}</dd></div>
          <div><dt class="text-xs text-muted">Email verified</dt><dd class="font-semibold">{{ info.verified === undefined ? 'Not available' : info.verified ? 'Yes' : 'No' }}</dd></div>
          <div><dt class="text-xs text-muted">Last sign-in</dt><dd class="font-semibold">{{ fmt(info.last) }}</dd></div>
          <div><dt class="text-xs text-muted">PMS account created</dt><dd class="font-semibold">{{ fmt(info.created) }}</dd></div>
          <div><dt class="text-xs text-muted">Last time the app checked you in</dt><dd class="font-semibold">{{ fmt(me.lastLoginAt) }}</dd></div>
        </dl>
        <button class="btn-ghost mt-4" @click="signOut"><LogOut class="h-4 w-4" />Sign out</button>
        <p class="mt-3 text-xs text-muted">Signing out of every device and deleting an account need a secured server step that this app does not have yet, so they are not offered here. Ask a Director if you need either.</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.card { @apply rounded-2xl border border-line bg-surface p-5 shadow-card; }
.h { @apply mb-3 text-sm font-extrabold; }
.chk { @apply flex items-center gap-2 py-1 text-sm font-semibold; }
.chk input { accent-color: var(--accent); }
</style>
