// "Update all from PMS" on the Staff page (Directors): asks the TMS server to copy every profile's name, role,
// department and switched-off state from the PMS (api/_pms-staff.js). Uses this person's PMS sign-in, like pmsIssues.js.
import { pmsAuth } from '@/firebase/config'

export async function syncAllStaffFromPms() {
  if (!pmsAuth.currentUser) throw new Error('Sign in again first')
  const token = await pmsAuth.currentUser.getIdToken()
  let r
  try {
    r = await fetch('/api/pms-task', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'syncStaff', data: { all: true } }),
    })
  } catch { throw new Error('The task system server could not be reached') }
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error || `The task system server answered ${r.status}`)
  return body
}
