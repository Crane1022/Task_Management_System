<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Info } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { subscribeUsers, updateUser } from '@/services/userService'
import { ROLES, DEPT_FOR_PMS_ROLE, deptName } from '@/utils/constants'

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
    const dept = DEPT_FOR_PMS_ROLE[u.pmsRole]
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
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
})

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
        <h1 class="mr-2 text-lg font-extrabold">Staff</h1>
        <input v-model="search" class="input ml-auto w-56" placeholder="Search name or email" aria-label="Search staff" />
      </div>
      <div class="mt-3 flex items-start gap-2 rounded-xl border border-line bg-surface p-3 text-sm text-muted">
        <Info class="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <p>Accounts are made on the <b class="text-ink">PMS Staff accounts</b> page, and staff sign in here with their PMS email and password. Someone appears in this list after their first sign-in, or once a Director assigns them a task from the PMS. Switching someone off in the PMS also blocks them here.</p>
      </div>

      <div v-if="loading" class="mt-4 space-y-2"><div v-for="n in 5" :key="n" class="skeleton h-12" /></div>
      <div v-else-if="error" class="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200" role="alert">
        <p class="font-bold">The staff list could not load.</p><p class="mt-1">{{ error }}</p>
      </div>
      <p v-else-if="!rows.length" class="mt-6 text-center text-sm font-semibold text-muted">{{ search ? 'Nobody matches this search.' : 'Nobody has signed in yet.' }}</p>
      <div v-else class="mt-2 overflow-x-auto">
        <table class="w-full min-w-[720px] border-separate border-spacing-y-1.5 text-left text-sm">
          <thead class="text-xs font-bold text-muted">
            <tr><th class="px-3 py-1">Name</th><th class="px-3 py-1">Email</th><th class="px-3 py-1">Department</th><th class="px-3 py-1">Role here</th></tr>
          </thead>
          <tbody>
            <tr v-for="u in rows" :key="u.id">
              <td class="rounded-l-xl border-y border-l border-line bg-surface px-3 py-2.5 font-bold">
                {{ u.name }}<span v-if="u.id === auth.user.uid" class="ml-1.5 text-xs font-semibold text-muted">(you)</span>
                <span v-if="u.stub" class="ml-1.5 rounded-md bg-bg px-1.5 py-0.5 text-xs font-semibold text-muted" title="Assigned a task from the PMS, has not signed in yet">not signed in yet</span>
              </td>
              <td class="border-y border-line bg-surface px-3 py-2.5 text-muted">{{ u.email || '—' }}</td>
              <!-- Department = the person's PMS role (changed on the PMS Staff accounts page) -->
              <td class="border-y border-line bg-surface px-3 py-2.5">{{ deptName(DEPT_FOR_PMS_ROLE[u.pmsRole] ?? u.departmentId) }}</td>
              <td class="rounded-r-xl border-y border-r border-line bg-surface px-3 py-1.5">
                <!-- You can't change your own role, so there is always a Director. A PMS Director is always a Director here -->
                <select :value="u.role" class="input w-48" :disabled="saving === u.id || u.id === auth.user.uid || u.pmsRole === 'director'" :aria-label="`Role of ${u.name}`" @change="change(u, 'role', $event.target.value)">
                  <option v-for="r in ROLE_OPTIONS" :key="r.id" :value="r.id">{{ r.name }}</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
