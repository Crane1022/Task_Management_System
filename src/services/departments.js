// Departments made from PMS roles (17 Nov 2026, Khairul: the PMS role is the TMS department).
// - Active roles made on the PMS Roles page: read from the PMS roles/ (this browser is signed in to the PMS too).
// - departments/{roleId} here: the name saved by the sign-in function (api/pms-login.js) whenever someone of that role
//   signs in. It stays after the role is removed in the PMS, so old tasks keep the name, shown as terminated.
// - The AI Agent's department, 'ai'.
import { db, pmsDb } from '@/firebase/config'
import { collection, getDocs } from '@/firebase/sdk'
import { setRoleDepartments, isFixedDepartment } from '@/utils/constants'

const BUILTIN_PMS_ROLES = ['director', 'branchDirector', 'finance', 'it', 'hr', 'operations', 'procurement', 'marketing', 'ai']

export async function loadDepartments() {
  const [pms, saved] = await Promise.all([
    getDocs(collection(pmsDb, 'roles')).catch((e) => { console.warn('PMS roles not readable:', e.message); return null }),
    getDocs(collection(db, 'departments')).catch((e) => { console.warn('Departments not readable:', e.message); return null }),
  ])
  const byId = {}
  // Saved names: terminated unless the PMS still has the role switched on. If the PMS could not be read, don't guess.
  for (const d of saved?.docs || []) byId[d.id] = { id: d.id, name: d.data().name || d.id, gone: !!pms }
  for (const d of pms?.docs || []) {
    if (BUILTIN_PMS_ROLES.includes(d.id) || isFixedDepartment(d.id)) continue
    const r = d.data()
    byId[d.id] = { id: d.id, name: r.name || byId[d.id]?.name || d.id, gone: r.active === false }
  }
  byId.ai = { id: 'ai', name: 'AI Agent', gone: false }
  setRoleDepartments(Object.values(byId))
}
