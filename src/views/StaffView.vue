<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Info, RefreshCw } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { subscribeUsers, updateUser } from '@/services/userService'
import { syncAllStaffFromPms } from '@/services/staffSync'
import { ROLES, deptForRole, deptName } from '@/utils/constants'
import UserAvatar from '@/components/UserAvatar.vue'

// Director (super_admin): set each person's role here. The department follows the PMS role. Accounts are not made here:
// they are made on the PMS Staff accounts page, and people appear after their first sign-in
// (or once a Director assigns them a task from the PMS).
const auth = useAuthStore()
const ui = useUiStore()
const users = ref({})
const loading = ref(true)
const error = ref('')
const saving = ref('')
const search = ref('')

const ROLE_OPTIONS = [
  { id: ROLES.SUPER_ADMIN, name: 'Director' },
  { id: ROLES.MANAGER, name: 'Department Manager' },
  { id: ROLES.EMPLOYEE, name: 'Employee' },
]

// Profiles made before the department followed the PMS role are brought in line once, when a Director opens this page.
// (Sign-in keeps them in line from then on.)
const synced = new Set()
function syncDepartments(list) {
  for (const u of Object.values(list)) {
    const dept = deptForRole(u.pmsRole)
    if (!dept || u.departmentId === dept || synced.has(u.id)) continue
    synced.add(u.id)
    updateUser(u.id, { departmentId: dept }).catch((e) => console.error('Department sync failed', u.id, e))
  }
}

let unsub
onMounted(() => {
  unsub = subscribeUsers((u) => { users.value = u; loading.value = false; syncDepartments(u) }, (e) => { error.value = e.message; loading.value = false })
})
onUnmounted(() => unsub?.())

const rows = computed(() => {
  const s = search.value.trim().toLowerCase()
  return Object.values(users.value)
    .filter((u) => !s || `${u.name} ${u.email ?? ''}`.toLowerCase().includes(s))
    // switched off in the PMS: at the bottom
    .sort((a, b) => (!!a.pmsOff - !!b.pmsOff) || (a.name ?? '').localeCompare(b.name ?? ''))
})

// "Update all from PMS" (Directors): every profile here follows the PMS staff records now (api/_pms-staff.js).
// The PMS also does this by itself for one person whenever their record is saved on PMS Staff accounts.
const updating = ref(false)
async function updateAll() {
  updating.value = true
  try {
    const r = await syncAllStaffFromPms()
    ui.toast(`Updated from the PMS: ${r.updated} changed, ${r.switchedOff} switched off, ${r.unchanged} already up to date${r.skipped ? `, ${r.skipped} skipped` : ''}`)
  } catch (e) {
    console.error(e)
    ui.toast(`Could not update from the PMS: ${e.message}`, 'error')
  } finally {
    updating.value = false
  }
}

async function change(u, field, value) {
  saving.value = u.id
  try {
    await updateUser(u.id, { [field]: value || null })
    ui.toast(`${u.name}: ${{ role: 'role' }[field]} saved`)
  } catch (e) {
    console.error(e)
    ui.toast(`Could not save: ${e.code ?? e.message}`, 'error')
  } finally {
    saving.value = ''
  }
}
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto max-w-6xl px-4 pb-10 pt-4">
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="mr-2 hidden text-lg font-extrabold sm:block">Staff</h1>
        <input v-model="search" class="input w-full sm:ml-auto sm:w-56" placeholder="Search name or email" aria-label="Search staff" />
        <button v-if="auth.isAdmin" type="button" class="btn-ghost inline-flex w-full items-center gap-1.5 sm:w-auto" :disabled="updating" v-busy="updating" title="Copy names, roles, departments and switched-off staff from the PMS now" @click="updateAll">
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': updating }" />{{ updating ? 'Updating...' : 'Update all from PMS' }}
        </button>
      </div>
      <div class="mt-3 flex items-start gap-2 rounded-xl border border-line bg-surface p-3 text-sm text-muted">
        <Info class="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <p>Accounts are made on the <b class="text-ink">PMS Staff accounts</b> page, and staff sign in here with their PMS email and password. Someone appears in this list after their first sign-in, or once a Director assigns them a task from the PMS. Changes saved there (name, role, switched off) reach this list straight away. Switching someone off in the PMS signs them out here too.</p>
      </div>

      <div v-if="loading" class="mt-4 space-y-2" role="status" aria-label="Loading staff"><div v-for="n in 5" :key="n" class="skeleton h-12" /></div>
      <div v-else-if="error" class="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200" role="alert">
        <p class="font-bold">The staff list could not load.</p><p class="mt-1">{{ error }}</p>
      </div>
      <p v-else-if="!rows.length" class="mt-6 text-center text-sm font-semibold text-muted">{{ search ? 'Nobody matches this search.' : 'Nobody has signed in yet.' }}</p>
      <!-- phone (25 Nov 2026): one card per person -->
      <div v-else>
      <ul class="mt-3 space-y-2 sm:hidden">
        <li v-for="u in rows" :key="u.id" class="rounded-2xl border border-line bg-surface p-3.5" :class="{ 'opacity-50': u.pmsOff }">
          <div class="flex items-center gap-2.5">
            <UserAvatar :user="u" :size="36" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-[15px] font-extrabold">{{ u.name }}<span v-if="u.id === auth.user.uid" class="ml-1 text-xs font-semibold text-muted">(you)</span></p>
              <p class="truncate text-xs text-muted">{{ u.email || '—' }}</p>
            </div>
            <span v-if="u.pmsOff" class="shrink-0 rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/50 dark:text-red-200">Switched off</span>
            <span v-else class="shrink-0 rounded-md bg-bg px-1.5 py-0.5 text-xs font-bold text-muted">{{ deptName(deptForRole(u.pmsRole) ?? u.departmentId) }}</span>
          </div>
          <p v-if="u.stub" class="mt-1 text-xs font-semibold text-muted">Not signed in yet</p>
          <label class="mt-2.5 block">
            <span class="label flex items-center gap-1.5">Role here<span v-if="saving === u.id" class="flex items-center gap-1 text-highlight" role="status"><span class="sync-dot" />Saving</span></span>
            <select :value="u.role" class="input" :disabled="saving === u.id || u.id === auth.user.uid || u.pmsRole === 'director' || u.pmsOff" :aria-label="`Role of ${u.name}`" @change="change(u, 'role', $event.target.value)">
              <option v-for="r in ROLE_OPTIONS" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
          </label>
        </li>
      </ul>
      <div class="mt-2 hidden overflow-x-auto sm:block">
        <table class="w-full min-w-[560px] lg:min-w-[720px] border-separate border-spacing-y-1.5 text-left text-sm">
          <thead class="text-xs font-bold text-muted">
            <tr><th class="px-3 py-1">Name</th><th class="hidden px-3 py-1 lg:table-cell">Email</th><th class="px-3 py-1">Department</th><th class="px-3 py-1">Role here</th></tr>
          </thead>
          <tbody>
            <tr v-for="u in rows" :key="u.id" :class="{ 'opacity-50': u.pmsOff }">
              <td class="rounded-l-xl border-y border-l border-line bg-surface px-3 py-2.5 font-bold">
                {{ u.name }}<span v-if="u.id === auth.user.uid" class="ml-1.5 text-xs font-semibold text-muted">(you)</span>
                <span class="block text-xs font-normal text-muted lg:hidden">{{ u.email }}</span>
                <span v-if="u.stub" class="ml-1.5 rounded-md bg-bg px-1.5 py-0.5 text-xs font-semibold text-muted" title="Assigned a task from the PMS, has not signed in yet">not signed in yet</span>
              </td>
              <td class="hidden border-y border-line bg-surface px-3 py-2.5 text-muted lg:table-cell">{{ u.email || '—' }}</td>
              <!-- Department = the person's PMS role (changed on the PMS Staff accounts page) -->
              <td class="border-y border-line bg-surface px-3 py-2.5">
                <span v-if="u.pmsOff" class="rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/50 dark:text-red-200" title="Switched off on the PMS Staff accounts page. Switch them on there to let them back in.">Switched off in PMS</span>
                <template v-else>{{ deptName(deptForRole(u.pmsRole) ?? u.departmentId) }}</template>
              </td>
              <td class="rounded-r-xl border-y border-r border-line bg-surface px-3 py-1.5">
                <!-- You can't change your own role, so there is always a Director. A PMS Director is always a Director here -->
                <select :value="u.role" class="input w-48" :disabled="saving === u.id || u.id === auth.user.uid || u.pmsRole === 'director' || u.pmsOff" :aria-label="`Role of ${u.name}`" @change="change(u, 'role', $event.target.value)">
                  <option v-for="r in ROLE_OPTIONS" :key="r.id" :value="r.id">{{ r.name }}</option>
                </select>
                <span v-if="saving === u.id" class="ml-2 inline-flex items-center gap-1.5 text-xs font-semibold text-highlight" role="status"><span class="sync-dot" />Saving</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>
    </div>
  </div>
</template>
